(() => {
  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function makeStorageKey(uniqueId) {
    return `learning-tools:completion:v2:${uniqueId}`;
  }

  function getCompleted(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const data = safeJsonParse(raw);
      if (!data || typeof data !== "object") return null;
      if (!data.completedAt) return null;
      return data;
    } catch {
      return null;
    }
  }

  function setCompleted(storageKey, payload) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Ignore (storage disabled/quota); UI still shows completion.
    }
  }

  function clearCompleted(storageKey) {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore.
    }
  }

  function certificateSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 21l4-2 4 2v-6" />
        <path d="M12 3a7 7 0 1 0 0 14a7 7 0 0 0 0-14z" />
        <path d="M9.3 10.8l1.8 1.8 3.9-4.1" />
      </svg>
    `;
  }

  function ensureBanner(containerEl) {
    const existing = containerEl.querySelector(".lt-completion");
    if (existing) return existing;

    const banner = document.createElement("div");
    banner.className = "lt-completion";
    banner.hidden = true;
    banner.innerHTML = `
      <div class="lt-completion__badge">${certificateSvg()}</div>
      <div>
        <div class="lt-completion__title" data-lt-title>Behaald</div>
        <div class="lt-completion__meta" data-lt-meta></div>
      </div>
      <div class="lt-completion__actions">
        <button type="button" class="lt-btn lt-btn--primary" data-lt-redo>Opnieuw doen</button>
      </div>
    `;

    containerEl.prepend(banner);
    return banner;
  }

  function formatDateTime(isoString) {
    try {
      const dt = new Date(isoString);
      return dt.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  }

  function createCooldown({ seconds, toolId, uniqueId, dataUrl, containerEl }) {
    const duration = Number.isInteger(seconds) && seconds >= 0 && seconds <= 86400 ? seconds : 0;
    const key = `learning-tools:cooldown:v1:${JSON.stringify([toolId, uniqueId, dataUrl || null])}`;
    const selector = '#check, #checkScore, #start, #restart-button, #restart, #next, #good-button, #wrong-button, #yes, #no, #reset, [data-lt-redo], [data-cooldown-attempt]';
    let until = 0, timer = null, observer = null, notice = null;
    const marked = new Map();
    if (duration) { try { const saved = Number(localStorage.getItem(key)); if (Number.isFinite(saved) && saved > Date.now()) until = Math.min(saved, Date.now() + 86400000); } catch {} }
    const remaining = () => Math.max(0, Math.ceil((until - Date.now()) / 1000));
    function paint() {
      const left = remaining();
      if (left && !notice) {
        notice = document.createElement('p'); notice.className = 'lt-cooldown';
        notice.setAttribute('role', 'timer'); notice.setAttribute('aria-live', 'off');
        containerEl.prepend(notice);
      }
      if (notice) { notice.hidden = !left; const label = `Nieuwe poging mogelijk over ${left} seconde${left === 1 ? '' : 'n'}.`; if (notice.textContent !== label) notice.textContent = label; }
      if (left) {
        containerEl.querySelectorAll(selector).forEach(button => {
          if (!marked.has(button)) marked.set(button, button.getAttribute('aria-disabled'));
          button.setAttribute('aria-disabled', 'true'); button.setAttribute('data-lt-cooldown-blocked', '');
        });
      } else {
        for (const [button, previous] of marked) {
          if (previous === null) button.removeAttribute('aria-disabled'); else button.setAttribute('aria-disabled', previous);
          button.removeAttribute('data-lt-cooldown-blocked');
        }
        marked.clear(); clearInterval(timer); timer = null; observer?.disconnect(); observer = null;
        if (duration) { try { localStorage.removeItem(key); } catch {} }
      }
    }
    function watch() {
      paint();
      if (remaining() && !timer) {
        timer = setInterval(paint, 200);
        observer = new MutationObserver(paint); observer.observe(containerEl, { childList: true, subtree: true });
      }
    }
    if (duration) containerEl.addEventListener('click', event => {
      if (remaining() && event.target.closest(selector)) { event.preventDefault(); event.stopImmediatePropagation(); paint(); }
    }, true);
    watch();
    return {
      get active() { return remaining() > 0; },
      start(minimum = 0) {
        if (!duration) return;
        until = Date.now() + Math.max(duration, Number.isFinite(minimum) ? minimum : 0) * 1000;
        try { localStorage.setItem(key, String(until)); } catch {}
        watch();
      },
    };
  }

  function create({ toolId, version, dataUrl, title, containerEl, onReset, uniqueId, standalone = true, cooldownSeconds = 0 }) {
    if (!containerEl) throw new Error("LearningToolsCompletion.create: containerEl is required");
    if (!uniqueId || typeof uniqueId !== "string") throw new Error("LearningToolsCompletion.create: uniqueId is required");
    const legacyKey = makeStorageKey(uniqueId);
    let storageKey = legacyKey, scope = null, remaining = null;
    let currentPayload = getCompleted(storageKey), freshPayload = null;
    let channel = null;
    const sessionResults = new Map();

    const banner = ensureBanner(containerEl);
    const titleEl = banner.querySelector("[data-lt-title]");
    const metaEl = banner.querySelector("[data-lt-meta]");
    const redoBtn = banner.querySelector("[data-lt-redo]");
    const cooldown = createCooldown({ seconds: cooldownSeconds, toolId, uniqueId, dataUrl, containerEl });

    function show(payload) {
      titleEl.textContent = scope ? "Je hebt deze opdracht goed gemaakt" : "Certificaat behaald";
      const when = payload?.completedAt ? formatDateTime(payload.completedAt) : null;
      const score = payload?.score ? (typeof payload.score.value === "number" ? `${payload.score.value} punten` : `${payload.score.correct}/${payload.score.total}`) : null;
      const parts = [title ? `Opdracht: ${title}` : null, score ? `Score: ${score}` : null, when ? `Afgerond: ${when}` : null].filter(Boolean);
      if (scope) parts.push(remaining === 0 ? "Alle opdrachten zijn afgerond. Download je certificaat bij Opdrachtcertificaat." : remaining === null ? "De overige opdrachten worden gecontroleerd…" : `Rond de overige ${remaining} opdracht${remaining === 1 ? "" : "en"} af om je certificaat te downloaden.`);
      metaEl.textContent = parts.join(" · ");
      banner.hidden = !scope && !standalone;
    }

    function hide() {
      banner.hidden = true;
    }

    function markCompleted({ score } = {}) {
      const payload = {
        toolId,
        version,
        uniqueId,
        unique_id: uniqueId,
        dataUrl: dataUrl || null,
        title: title || null,
        score: score && (Number.isFinite(score.value) || (Number.isFinite(score.correct) && Number.isFinite(score.total))) ? score : null,
        completed: true,
        completedAt: new Date().toISOString(),
      };
      currentPayload = payload; freshPayload = scope ? null : payload;
      sessionResults.set(storageKey, payload);
      setCompleted(storageKey, payload);
      show(payload);
      channel?.publish();
    }

    function reset() {
      if (cooldown.active) return;
      clearCompleted(storageKey);
      sessionResults.delete(storageKey);
      currentPayload = null; freshPayload = null;
      channel?.publish();
      hide();
      if (typeof onReset === "function") onReset();
      else window.location.reload();
    }

    redoBtn.addEventListener("click", reset);

    if (currentPayload) show(currentPayload);
    channel = window.LearningToolsCertificate?.participant({
      uniqueId,
      getState: () => currentPayload ? { ...currentPayload, completed: true } : null,
      onScope(context) {
        const newAttempt = scope && context && scope.attemptId !== context.attemptId;
        scope = context; remaining = null;
        storageKey = scope ? `learning-tools:certificate-result:v1:${JSON.stringify([scope.groupId, scope.revision, scope.attemptId, uniqueId])}` : legacyKey;
        currentPayload = sessionResults.get(storageKey) || getCompleted(storageKey) || (scope ? freshPayload : null);
        freshPayload = null;
        if (currentPayload) { sessionResults.set(storageKey, currentPayload); setCompleted(storageKey, currentPayload); show(currentPayload); } else hide();
        if (newAttempt && !currentPayload) { if (typeof onReset === "function") onReset(); else window.location.reload(); }
      },
      onProgress(progress) { remaining = progress.remaining; if (currentPayload) show(currentPayload); },
    });

    return {
      get isCompleted() {
        return Boolean(currentPayload);
      },
      get isGrouped() { return Boolean(scope); },
      get cooldownActive() { return cooldown.active; },
      beginAttempt(minimum = 0) { if (cooldown.active) return false; cooldown.start(minimum); return true; },
      startCooldown: () => cooldown.start(),
      markCompleted,
      reset,
      get storageKey() { return storageKey; },
    };
  }

  window.LearningToolsCompletion = { create };
})();
