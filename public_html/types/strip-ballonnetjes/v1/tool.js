(function () {
  const titleEl = document.getElementById("title");
  const hintEl = document.getElementById("hint");
  const pagesEl = document.getElementById("pages");
  const navEl = document.getElementById("nav");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const pageMetaEl = document.getElementById("pageMeta");

  const params = new URLSearchParams(window.location.search);
  const dataUrl = params.get("data") || "";

  let currentConfig = {};
  let currentPages = [];
  let currentIndex = 0;
  let relayout = () => {};

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
    hintEl.textContent = text || "";
    hintEl.className = kind === "error" ? "hint error" : "hint";
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

  const applyLayoutForPage = (pageEl, imgEl, bubbles) => {
    const designWidthRaw = pageEl.dataset.designWidth || "";
    const fallbackWidth = imgEl.naturalWidth || imgEl.clientWidth || 1;
    const designWidth = Math.max(1, toNum(designWidthRaw, fallbackWidth));
    const renderedWidth = imgEl.clientWidth || 1;
    const scale = renderedWidth / Math.max(1, designWidth);
    pageEl.style.setProperty("--scale", String(scale));

    bubbles.forEach((b) => {
      const x = toNum(b.dataset.x, 0);
      const y = toNum(b.dataset.y, 0);
      const w = Math.max(40, toNum(b.dataset.w, 220));
      b.style.left = `${Math.round(x * scale)}px`;
      b.style.top = `${Math.round(y * scale)}px`;
      b.style.width = `${Math.round(w * scale)}px`;
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
      el.textContent = String(bubble.text || "");
      el.dataset.x = String(bubble.x ?? 0);
      el.dataset.y = String(bubble.y ?? 0);
      el.dataset.w = String(bubble.width ?? 240);
      el.dataset.tail = normalizeTail(bubble.tail);
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

    const title = String(config.title || "Strip ballonnetjes");
    if (titleEl) titleEl.textContent = title;

    const pages = Array.isArray(config.pages) ? config.pages : [];
    if (pages.length === 0) {
      setHint('Geen "pages" gevonden in JSON.', "error");
      return;
    }

    currentConfig = config || {};
    currentPages = pages;
    if (currentIndex >= currentPages.length) currentIndex = 0;

    if (currentConfig.showAllPages === true) {
      renderAllPages(currentConfig);
      setHint('Tip: positions zijn in pixels t.o.v. de originele afbeelding (designWidth of naturalWidth).');
      return;
    }

    renderSinglePage(currentConfig);
    const navHint = currentPages.length > 1 ? " Gebruik Vorige/Volgende voor pagina’s." : "";
    setHint(`Tip: positions zijn in pixels t.o.v. de originele afbeelding (designWidth of naturalWidth).${navHint}`);
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
    if (currentConfig.showAllPages === true) return;
    if (currentPages.length <= 1) return;
    if (e.key === "ArrowLeft") goTo(currentIndex - 1);
    if (e.key === "ArrowRight") goTo(currentIndex + 1);
  });
})();
