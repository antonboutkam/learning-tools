(() => {
  function fnv1a32(input) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function makeStorageKey({ toolId, version, dataUrl }) {
    const raw = `${toolId}::${version}::${dataUrl || ""}`;
    const hash = fnv1a32(raw).toString(16).padStart(8, "0");
    return `learning-tools:completion:v1:${toolId}:${version}:${hash}`;
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

  function create({ toolId, version, dataUrl, title, containerEl, onReset }) {
    if (!containerEl) throw new Error("LearningToolsCompletion.create: containerEl is required");
    const storageKey = makeStorageKey({ toolId, version, dataUrl });

    const banner = ensureBanner(containerEl);
    const titleEl = banner.querySelector("[data-lt-title]");
    const metaEl = banner.querySelector("[data-lt-meta]");
    const redoBtn = banner.querySelector("[data-lt-redo]");

    function show(payload) {
      titleEl.textContent = "Certificaat behaald";
      const when = payload?.completedAt ? formatDateTime(payload.completedAt) : null;
      const score = payload?.score ? `${payload.score.correct}/${payload.score.total}` : null;
      const parts = [title ? `Opdracht: ${title}` : null, score ? `Score: ${score}` : null, when ? `Afgerond: ${when}` : null].filter(Boolean);
      metaEl.textContent = parts.join(" · ");
      banner.hidden = false;
    }

    function hide() {
      banner.hidden = true;
    }

    function markCompleted({ score } = {}) {
      const payload = {
        toolId,
        version,
        dataUrl: dataUrl || null,
        title: title || null,
        score: score && typeof score.correct === "number" && typeof score.total === "number" ? score : null,
        completedAt: new Date().toISOString(),
      };
      setCompleted(storageKey, payload);
      show(payload);
    }

    function reset() {
      clearCompleted(storageKey);
      hide();
      if (typeof onReset === "function") onReset();
      else window.location.reload();
    }

    redoBtn.addEventListener("click", reset);

    const existing = getCompleted(storageKey);
    if (existing) show(existing);

    return {
      get isCompleted() {
        return Boolean(getCompleted(storageKey));
      },
      markCompleted,
      reset,
      storageKey,
    };
  }

  window.LearningToolsCompletion = { create };
})();
