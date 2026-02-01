(function () {
  const titleEl = document.getElementById("title");
  const hintEl = document.getElementById("hint");
  const pagesEl = document.getElementById("pages");

  const params = new URLSearchParams(window.location.search);
  const dataUrl = params.get("data") || "";

  const setHint = (text, kind = "") => {
    if (!hintEl) return;
    hintEl.textContent = text || "";
    hintEl.className = kind === "error" ? "hint error" : "hint";
  };

  const toNum = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const normalizeTail = (value) => {
    const v = String(value || "").toLowerCase();
    if (v === "left" || v === "links") return "left";
    if (v === "right" || v === "rechts") return "right";
    return "none";
  };

  const applyLayoutForPage = (pageEl, imgEl, bubbles) => {
    const designWidthRaw = pageEl.dataset.designWidth || "";
    const designWidth = toNum(designWidthRaw, imgEl.naturalWidth || imgEl.clientWidth || 1);
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

  const render = (config) => {
    if (!pagesEl) return;

    const title = String(config.title || "Strip ballonnetjes");
    if (titleEl) titleEl.textContent = title;

    const pages = Array.isArray(config.pages) ? config.pages : [];
    if (pages.length === 0) {
      setHint('Geen "pages" gevonden in JSON.', "error");
      return;
    }

    pagesEl.innerHTML = "";
    const relayoutTasks = [];

    pages.forEach((page, index) => {
      if (!page || typeof page !== "object") return;

      const image = String(page.image || page.imageUrl || "");
      if (!image) return;

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

      pagesEl.appendChild(pageEl);

      const doLayout = () => applyLayoutForPage(pageEl, img, bubbleEls);

      img.addEventListener("load", doLayout, { once: true });
      if (img.complete && img.naturalWidth) {
        doLayout();
      }
      relayoutTasks.push(doLayout);
    });

    const onResize = () => {
      relayoutTasks.forEach((fn) => fn());
    };

    window.addEventListener("resize", onResize);
    setHint('Tip: positions zijn in pixels t.o.v. de originele afbeelding (designWidth of naturalWidth).');
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
})();

