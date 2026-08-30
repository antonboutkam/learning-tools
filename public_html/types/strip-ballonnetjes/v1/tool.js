(function () {
  const titleEl = document.getElementById("title");
  const hintEl = document.getElementById("hint");
  const pagesEl = document.getElementById("pages");
  const navEl = document.getElementById("nav");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const pageMetaEl = document.getElementById("pageMeta");
  const answersEl = document.getElementById("answers");

  const params = new URLSearchParams(window.location.search);
  const dataUrl = params.get("data") || "";
  const STORAGE_VERSION = 1;
  const STORAGE_PREFIX = "learning-tools:strip-ballonnetjes:v1:";

  let currentConfig = {};
  let currentPages = [];
  let currentIndex = 0;
  let relayout = () => {};
  let storageInstanceId = "";
  let answerDefaults = new Map();
  let persistedAnswers = new Map();

  const embedderBaseUrl = (() => {
    const referrer = String(document.referrer || "").trim();
    if (referrer) return referrer;

    const ancestorOrigins = window.location && window.location.ancestorOrigins;
    if (ancestorOrigins && ancestorOrigins.length) {
      return `${String(ancestorOrigins[0]).replace(/\/+$/, "")}/`;
    }

    return window.location.href;
  })();

  const toAbsoluteUrl = (maybeUrl) => {
    const raw = String(maybeUrl || "").trim();
    if (!raw) return "";
    if (raw.startsWith("//")) {
      try {
        return `${new URL(embedderBaseUrl).protocol}${raw}`;
      } catch {
        return `${window.location.protocol}${raw}`;
      }
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw;
    try {
      return new URL(raw, embedderBaseUrl).href;
    } catch {
      return raw;
    }
  };

  const setHint = (text, kind = "") => {
    if (!hintEl) return;
    const value = String(text || "");
    hintEl.textContent = value;
    hintEl.className = kind === "error" ? "hint error" : "hint";
    hintEl.hidden = value.length === 0;
  };

  const toNum = (value, fallback = 0) => {
    if (value === "" || value === null || value === undefined) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const normalizeTail = (value) => {
    const v = String(value || "").toLowerCase();
    if (v === "left" || v === "links") return "left";
    if (v === "right" || v === "rechts") return "right";
    return "none";
  };

  const normalizeBubbleType = (value) => {
    const v = String(value || "").toLowerCase();
    if (v === "gedachte" || v === "thought") return "thought";
    if (v === "vraag" || v === "question") return "question";
    return "speech";
  };

  const isValidVariableName = (value) => /^[a-z0-9_]+$/.test(String(value || ""));

  const storageKey = () => `${STORAGE_PREFIX}${storageInstanceId}`;

  const getAnswer = (variable) => {
    if (persistedAnswers.has(variable)) return persistedAnswers.get(variable);
    return answerDefaults.get(variable) || "";
  };

  const interpolateText = (template) =>
    String(template || "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (_match, variable) => getAnswer(variable));

  const validateQuestions = (config) => {
    const pages = Array.isArray(config.pages) ? config.pages : [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const bubbles = Array.isArray(pages[pageIndex]?.bubbles) ? pages[pageIndex].bubbles : [];
      for (let bubbleIndex = 0; bubbleIndex < bubbles.length; bubbleIndex += 1) {
        const bubble = bubbles[bubbleIndex];
        if (normalizeBubbleType(bubble?.type) !== "question") continue;
        if (!isValidVariableName(bubble?.variable)) {
          return `Vraagballon ${bubbleIndex + 1} op pagina ${pageIndex + 1} heeft een ongeldige variabelenaam. Gebruik alleen kleine letters, cijfers en underscores.`;
        }
      }
    }
    return "";
  };

  const loadAnswerState = (config) => {
    storageInstanceId = String(
      params.get("unique_id") || config.unique_id || dataUrl || window.location.pathname
    ).trim();
    answerDefaults = new Map();
    persistedAnswers = new Map();

    const pages = Array.isArray(config.pages) ? config.pages : [];
    pages.forEach((page) => {
      const bubbles = Array.isArray(page?.bubbles) ? page.bubbles : [];
      bubbles.forEach((bubble) => {
        if (normalizeBubbleType(bubble?.type) !== "question") return;
        const variable = String(bubble.variable || "");
        if (!isValidVariableName(variable) || answerDefaults.has(variable)) return;
        answerDefaults.set(variable, String(bubble.defaultValue ?? ""));
      });
    });

    try {
      const raw = window.localStorage.getItem(storageKey());
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (stored?.storageVersion !== STORAGE_VERSION || !stored.answers || typeof stored.answers !== "object") return;
      Object.entries(stored.answers).forEach(([variable, value]) => {
        if (isValidVariableName(variable) && typeof value === "string") persistedAnswers.set(variable, value);
      });
    } catch (_) {}
  };

  const saveAnswerState = () => {
    try {
      window.localStorage.setItem(
        storageKey(),
        JSON.stringify({ storageVersion: STORAGE_VERSION, answers: Object.fromEntries(persistedAnswers) })
      );
    } catch (_) {}
  };

  const updateBubbleTexts = () => {
    if (!pagesEl) return;
    pagesEl.querySelectorAll(".bubble__text[data-template]").forEach((textEl) => {
      textEl.textContent = interpolateText(textEl.dataset.template || "");
    });
  };

  const renderAnswerFields = (pages) => {
    if (!answersEl) return;
    answersEl.innerHTML = "";

    const questionsByVariable = new Map();
    pages.forEach((page) => {
      const bubbles = Array.isArray(page?.bubbles) ? page.bubbles : [];
      bubbles.forEach((bubble) => {
        if (normalizeBubbleType(bubble?.type) !== "question") return;
        const variable = String(bubble.variable || "");
        if (isValidVariableName(variable) && !questionsByVariable.has(variable)) {
          questionsByVariable.set(variable, bubble);
        }
      });
    });

    if (questionsByVariable.size === 0) {
      answersEl.hidden = true;
      return;
    }

    questionsByVariable.forEach((bubble, variable) => {
      const fieldEl = document.createElement("div");
      fieldEl.className = "answer";

      const inputId = `answer-${variable}`;
      const labelEl = document.createElement("label");
      labelEl.className = "sr-only";
      labelEl.htmlFor = inputId;
      labelEl.textContent = `Antwoord op: ${interpolateText(bubble.text)}`;

      const inputEl = document.createElement("input");
      inputEl.className = "answer__input";
      inputEl.id = inputId;
      inputEl.name = variable;
      inputEl.type = "text";
      inputEl.autocomplete = "off";
      inputEl.placeholder = String(bubble.placeholder || "");
      inputEl.value = getAnswer(variable);
      inputEl.dataset.variable = variable;
      inputEl.addEventListener("input", () => {
        persistedAnswers.set(variable, inputEl.value);
        saveAnswerState();
        answersEl.querySelectorAll(".answer__input").forEach((otherInput) => {
          if (otherInput !== inputEl && otherInput.dataset.variable === variable) otherInput.value = inputEl.value;
        });
        updateBubbleTexts();
      });

      fieldEl.append(labelEl, inputEl);
      answersEl.appendChild(fieldEl);
    });

    answersEl.hidden = false;
  };

  const applyLayoutForPage = (pageEl, imgEl, bubbles) => {
    const designWidthRaw = pageEl.dataset.designWidth || "";
    const fallbackWidth = imgEl.naturalWidth || imgEl.clientWidth || 1;
    const designWidth = Math.max(1, toNum(designWidthRaw, fallbackWidth));
    const renderedWidth = imgEl.clientWidth || 1;
    const viewportWidth = pagesEl && pagesEl.clientWidth ? pagesEl.clientWidth : renderedWidth;
    const sideOffset = Math.max(0, (viewportWidth - renderedWidth) / 2);
    const scale = renderedWidth / Math.max(1, designWidth);
    pageEl.style.setProperty("--scale", String(scale));

    bubbles.forEach((b) => {
      const isFullWidth = b.dataset.fullWidth === "true";
      const x = toNum(b.dataset.x, 0);
      const y = toNum(b.dataset.y, 0);
      const w = Math.max(40, toNum(b.dataset.w, 220));
      b.style.top = `${Math.round(y * scale)}px`;

      if (isFullWidth) {
        b.style.left = `${Math.round(-sideOffset)}px`;
        b.style.width = `${Math.round(viewportWidth)}px`;
        b.style.borderRadius = "0";
        return;
      }

      b.style.left = `${Math.round(x * scale)}px`;
      b.style.width = `${Math.round(w * scale)}px`;
      b.style.borderRadius = "";
    });
  };

  const updateNav = () => {
    if (!navEl) return;
    const total = currentPages.length;
    const show = total > 1 && currentConfig.showAllPages !== true;
    navEl.hidden = !show;
    if (!show) return;

    if (pageMetaEl) pageMetaEl.textContent = `${currentIndex + 1} / ${total}`;
    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= total - 1;
  };

  const buildPage = (page, index, config) => {
    if (!page || typeof page !== "object") return null;

    const image = toAbsoluteUrl(page.image);
    if (!image) return null;

    const pageEl = document.createElement("section");
    pageEl.className = "page";
    pageEl.dataset.designWidth = String(page.designWidth || "");

    const img = document.createElement("img");
    img.className = "page__img";
    img.loading = "lazy";
    img.src = image;
    img.alt = String(page.alt || page.title || `Afbeelding ${index + 1}`);

    pageEl.appendChild(img);

    const bubbleEls = [];
    const bubbles = Array.isArray(page.bubbles) ? page.bubbles : [];
    bubbles.forEach((bubble) => {
      if (!bubble || typeof bubble !== "object") return;
      const el = document.createElement("div");
      el.className = "bubble";
      el.dataset.type = normalizeBubbleType(bubble.type);

      const textEl = document.createElement("span");
      textEl.className = "bubble__text";
      textEl.dataset.template = String(bubble.text || "");
      textEl.textContent = interpolateText(textEl.dataset.template);
      el.appendChild(textEl);

      const hasWidth = bubble.width !== undefined && bubble.width !== null && bubble.width !== "";
      el.dataset.x = String(bubble.x ?? 0);
      el.dataset.y = String(bubble.y ?? 0);
      el.dataset.w = hasWidth ? String(bubble.width) : "";
      el.dataset.fullWidth = hasWidth ? "false" : "true";
      el.dataset.tail = hasWidth ? normalizeTail(bubble.tail) : "none";

      if (el.dataset.type === "thought" && el.dataset.tail !== "none") {
        const thoughtTail = document.createElement("span");
        thoughtTail.className = "bubble__thought-tail";
        thoughtTail.setAttribute("aria-hidden", "true");
        thoughtTail.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
        el.appendChild(thoughtTail);
      }

      pageEl.appendChild(el);
      bubbleEls.push(el);
    });

    if (config.debug === true) {
      const meta = document.createElement("div");
      meta.className = "page__meta";
      meta.textContent = `page ${index + 1}`;
      pageEl.appendChild(meta);
    }

    const doLayout = () => applyLayoutForPage(pageEl, img, bubbleEls);
    img.addEventListener("load", doLayout, { once: true });
    if (img.complete && img.naturalWidth) doLayout();

    return { pageEl, doLayout };
  };

  const renderAllPages = (config) => {
    pagesEl.innerHTML = "";
    const relayoutTasks = [];

    currentPages.forEach((page, index) => {
      const built = buildPage(page, index, config);
      if (!built) return;
      pagesEl.appendChild(built.pageEl);
      relayoutTasks.push(built.doLayout);
    });

    relayout = () => relayoutTasks.forEach((fn) => fn());
    renderAnswerFields(currentPages);
    updateNav();
  };

  const renderSinglePage = (config) => {
    pagesEl.innerHTML = "";
    const page = currentPages[currentIndex];
    const built = buildPage(page, currentIndex, config);
    if (!built) {
      setHint("Pagina bevat geen geldige afbeelding-URL.", "error");
      relayout = () => {};
      updateNav();
      return;
    }
    pagesEl.appendChild(built.pageEl);
    relayout = built.doLayout;
    renderAnswerFields([page]);
    updateNav();
  };

  const goTo = (index) => {
    if (currentConfig.showAllPages === true) return;
    const total = currentPages.length;
    if (total <= 1) return;
    currentIndex = clamp(index, 0, total - 1);
    renderSinglePage(currentConfig);
  };

  const render = (config) => {
    if (!pagesEl) return;

    const questionError = validateQuestions(config);
    if (questionError) {
      pagesEl.innerHTML = "";
      if (answersEl) answersEl.hidden = true;
      setHint(questionError, "error");
      return;
    }

    const title = String(config.title || "Strip ballonnetjes");
    if (titleEl) titleEl.textContent = title;

    const pages = Array.isArray(config.pages) ? config.pages : [];
    if (pages.length === 0) {
      setHint('Geen "pages" gevonden in JSON.', "error");
      return;
    }

    currentConfig = config || {};
    currentPages = pages;
    loadAnswerState(currentConfig);
    if (currentIndex >= currentPages.length) currentIndex = 0;
    document.body.classList.toggle("mode-all-pages", currentConfig.showAllPages === true);

    if (currentConfig.showAllPages === true) {
      renderAllPages(currentConfig);
      setHint("");
      return;
    }

    renderSinglePage(currentConfig);
    setHint("");
  };

  const load = async () => {
    if (!dataUrl) {
      setHint("Geen data URL meegegeven. Gebruik ?data=.../example.json", "error");
      return;
    }
    try {
      const res = await fetch(String(dataUrl), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      render(json || {});
    } catch (e) {
      setHint(`Kon JSON niet laden: ${String(e.message || e)}`, "error");
    }
  };

  load();

  window.addEventListener("resize", () => relayout());

  if (prevBtn) prevBtn.addEventListener("click", () => goTo(currentIndex - 1));
  if (nextBtn) nextBtn.addEventListener("click", () => goTo(currentIndex + 1));

  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target instanceof HTMLElement && (e.target.matches("input, textarea, select, button") || e.target.isContentEditable)) return;
    if (currentConfig.showAllPages === true) return;
    if (currentPages.length <= 1) return;
    if (e.key === "ArrowLeft") goTo(currentIndex - 1);
    if (e.key === "ArrowRight") goTo(currentIndex + 1);
  });
})();
