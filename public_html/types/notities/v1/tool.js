(function () {
  const titleEl = document.getElementById("title");
  const metaEl = document.getElementById("meta");
  const hintEl = document.getElementById("hint");

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const pagePill = document.getElementById("pagePill");
  const modeBtn = document.getElementById("modeBtn");
  const penSizeEl = document.getElementById("penSize");
  const penColorEl = document.getElementById("penColor");
  const clearBtn = document.getElementById("clearBtn");
  const addBookmarkBtn = document.getElementById("addBookmarkBtn");
  const downloadBtn = document.getElementById("downloadBtn");

  const bookEl = document.getElementById("book");

  const pageFrontEl = document.getElementById("pageFront");
  const pageBackEl = document.getElementById("pageBack");
  const tabFrontEl = document.getElementById("tabFront");
  const tabBackEl = document.getElementById("tabBack");
  const textFrontEl = document.getElementById("textFront");
  const textBackEl = document.getElementById("textBack");
  const inkFrontEl = document.getElementById("inkFront");
  const inkBackEl = document.getElementById("inkBack");
  const bookmarksEl = document.getElementById("bookmarks");

  if (!pageFrontEl || !pageBackEl || !textFrontEl || !textBackEl || !inkFrontEl || !inkBackEl || !bookmarksEl) return;

  const params = new URLSearchParams(window.location.search);
  const dataUrl = params.get("data") || "";
  const notebookIdFromQuery =
    params.get("notitieblok_id") ||
    params.get("notitieblokId") ||
    params.get("notities_id") ||
    params.get("unique_id") ||
    "";
  let notebookId = notebookIdFromQuery;
  downloadBtn && (downloadBtn.disabled = true);

  const setHint = (text, kind = "") => {
    if (!hintEl) return;
    hintEl.textContent = text || "";
    hintEl.className = kind === "error" ? "hint error" : "hint";
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const nowIso = () => new Date().toISOString();

  const normalizeBookmarkInput = (value) => {
    if (typeof value === "string") return { name: value };
    if (value && typeof value === "object" && typeof value.name === "string") return { name: value.name };
    return null;
  };

  const DB_NAME = "learning-tools-notities";
  const DB_VERSION = 1;

  const openDb = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("notebooks")) {
          db.createObjectStore("notebooks", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("pages")) {
          db.createObjectStore("pages", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("bookmarks")) {
          const store = db.createObjectStore("bookmarks", { keyPath: "key" });
          store.createIndex("byNotebook", "id", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("indexedDB open failed"));
    });

  const txGet = (store, key) =>
    new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error("get failed"));
    });

  const txPut = (store, value) =>
    new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error || new Error("put failed"));
    });

  const txGetAllByIndex = (store, indexName, indexKey) =>
    new Promise((resolve, reject) => {
      const idx = store.index(indexName);
      const req = idx.getAll(indexKey);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error || new Error("getAll failed"));
    });

  const txScanAll = (store, fn) =>
    new Promise((resolve, reject) => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(true);
        try {
          fn(cursor.value);
        } catch (e) {
          return reject(e);
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error || new Error("cursor failed"));
    });

  const debounce = (fn, waitMs) => {
    let t = null;
    let lastArgs = null;
    const flush = () => {
      if (t) window.clearTimeout(t);
      t = null;
      if (lastArgs) fn(...lastArgs);
      lastArgs = null;
    };
    const wrapped = (...args) => {
      lastArgs = args;
      if (t) window.clearTimeout(t);
      t = window.setTimeout(flush, waitMs);
    };
    wrapped.flush = flush;
    return wrapped;
  };

  const makePageKey = (id, pageIndex) => `${id}::p::${pageIndex}`;
  const makeBookmarkKey = (id, bookmarkId) => `${id}::b::${bookmarkId}`;
  const makeBookmarkId = () => `bm_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

  const createStroke = (color, width) => ({ color, width, points: [] });

  const drawStrokes = (ctx, strokes, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokes.forEach((s) => {
      const pts = Array.isArray(s.points) ? s.points : [];
      if (pts.length < 2) return;
      const sw = Number(s.width) || 2;
      ctx.strokeStyle = String(s.color || "#111827");
      ctx.lineWidth = sw;
      ctx.beginPath();
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * w, pts[i].y * h);
      }
      ctx.stroke();
    });
  };

  const setupCanvas = (canvas, getStrokes, setStrokes, isPenMode, onChange) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return { redraw: () => {}, clear: () => {} };

    let drawing = false;
    let stroke = null;
    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawStrokes(ctx, getStrokes(), rect.width, rect.height);
    };

    const getPoint = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      const y = clamp((e.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
      return { x, y, rect };
    };

    const pointerDown = (e) => {
      if (!isPenMode()) return;
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      const color = penColorEl ? String(penColorEl.value || "#111827") : "#111827";
      const width = penSizeEl ? clamp(Number(penSizeEl.value) || 4, 1, 18) : 4;
      stroke = createStroke(color, width);
      const p = getPoint(e);
      stroke.points.push({ x: p.x, y: p.y });
      const strokes = getStrokes().slice();
      strokes.push(stroke);
      setStrokes(strokes);
      drawStrokes(ctx, strokes, p.rect.width, p.rect.height);
      onChange();
    };

    const pointerMove = (e) => {
      if (!drawing || !stroke || !isPenMode()) return;
      const p = getPoint(e);
      stroke.points.push({ x: p.x, y: p.y });
      const strokes = getStrokes();
      drawStrokes(ctx, strokes, p.rect.width, p.rect.height);
      onChange();
    };

    const pointerUp = (e) => {
      if (!drawing) return;
      drawing = false;
      stroke = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
      onChange();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);

    return {
      redraw: () => resize(),
      clear: () => {
        setStrokes([]);
        resize();
        onChange();
      },
    };
  };

  const state = {
    db: null,
    config: { title: "Notities", pagesCount: 100, bookmarks: [] },
    notebook: null,
    bookmarks: [],
    currentPageIndex: 0,
    mode: "type", // "type" | "pen"
    front: null,
    back: null,
    animating: false,
    bookmarkCanvases: [],
  };

  const isPenMode = () => state.mode === "pen";

  const viewA = { root: pageFrontEl, tab: tabFrontEl, text: textFrontEl, canvas: inkFrontEl, pageIndex: 0, strokes: [], canvasCtl: null };
  const viewB = { root: pageBackEl, tab: tabBackEl, text: textBackEl, canvas: inkBackEl, pageIndex: 0, strokes: [], canvasCtl: null };
  state.front = viewA;
  state.back = viewB;

  const getActiveTabLabel = (pageIndex) => {
    const idx = Number(pageIndex || 0);
    const candidates = (Array.isArray(state.bookmarks) ? state.bookmarks : []).filter((b) => Number(b.pageIndex || 0) <= idx);
    if (candidates.length === 0) return "";
    candidates.sort((a, b) => {
      const pa = Number(a.pageIndex ?? -1);
      const pb = Number(b.pageIndex ?? -1);
      if (pa !== pb) return pb - pa; // hoogste pageIndex eerst
      const sa = Number(a.slot ?? 9999);
      const sb = Number(b.slot ?? 9999);
      return sa - sb; // laagste slot wint bij gelijke pageIndex
    });
    return String(candidates[0].name || "").trim();
  };

  const getPagesCount = () => Number(state.notebook?.pagesCount || state.config.pagesCount || 100);

  const getPageHeaderText = (pageIndex) => {
    const pagesCount = getPagesCount();
    const current = clamp(Number(pageIndex || 0) + 1, 1, Math.max(1, pagesCount));
    const tabName = getActiveTabLabel(pageIndex);
    if (tabName) return `Aantekeningen bij ${tabName} pagina (${current}/${pagesCount})`;
    return `Aantekeningen pagina (${current}/${pagesCount})`;
  };

  const updateViewTab = (view) => {
    if (!view?.tab) return;
    view.tab.textContent = getPageHeaderText(view.pageIndex);
  };

  const setMode = (mode) => {
    state.mode = mode;
    if (modeBtn) modeBtn.textContent = mode === "pen" ? "Pen" : "Typen";
    const activeView = state.front;
    activeView.text.readOnly = mode === "pen";
    activeView.text.style.pointerEvents = mode === "pen" ? "none" : "auto";
    activeView.canvas.style.pointerEvents = mode === "pen" ? "auto" : "none";
    clearBtn && (clearBtn.disabled = mode !== "pen");
    penSizeEl && (penSizeEl.disabled = mode !== "pen");
    penColorEl && (penColorEl.disabled = mode !== "pen");
  };

  const setActiveViewInteractivity = () => {
    state.front.root.style.pointerEvents = "auto";
    state.back.root.style.pointerEvents = "none";
    state.back.root.setAttribute("aria-hidden", "true");
    state.front.root.removeAttribute("aria-hidden");
    setMode(state.mode);
    state.back.text.readOnly = true;
    state.back.text.style.pointerEvents = "none";
    state.back.canvas.style.pointerEvents = "none";
  };

  const updateHeader = () => {
    const title = state.notebook?.title || state.config.title || "Notities";
    if (titleEl) titleEl.textContent = title;
    const pagesCount = Number(state.notebook?.pagesCount || state.config.pagesCount || 100);
    const cur = state.currentPageIndex + 1;
    if (pagePill) pagePill.textContent = `${cur} / ${pagesCount}`;
    if (metaEl) metaEl.textContent = notebookId ? `notitieblok_id: ${notebookId}` : "";
    if (prevBtn) prevBtn.disabled = state.animating || state.currentPageIndex <= 0;
    if (nextBtn) nextBtn.disabled = state.animating || state.currentPageIndex >= pagesCount - 1;
    updateViewTab(state.front);
    updateViewTab(state.back);
  };

  const loadConfig = async () => {
    if (!dataUrl) return { title: "Notities", pagesCount: 100, bookmarks: [] };
    const res = await fetch(String(dataUrl), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const cfg = (json && typeof json === "object") ? json : {};
    const notitieblokIdFromConfig = String(
      cfg.notitieblok_id || cfg.notitieblokId || cfg.notities_id || cfg.unique_id || ""
    ).trim();
    const layout = (cfg.layout && typeof cfg.layout === "object") ? cfg.layout : {};
    const format = String(layout.formaat || "Standaard");
    const maxWidthPx = layout.max_breedte_px != null ? Number(layout.max_breedte_px) : null;
    const customW = layout.custom_ratio_breedte != null ? Number(layout.custom_ratio_breedte) : null;
    const customH = layout.custom_ratio_hoogte != null ? Number(layout.custom_ratio_hoogte) : null;
    const pagesCount = clamp(Number(cfg.pagesCount ?? 100) || 100, 1, 1000);
    const rawBookmarks = Array.isArray(cfg.bookmarks) ? cfg.bookmarks : [];
    const bookmarks = rawBookmarks.map(normalizeBookmarkInput).filter(Boolean);
    return {
      notitieblok_id: notitieblokIdFromConfig,
      layout: { formaat: format, max_breedte_px: maxWidthPx, custom_ratio_breedte: customW, custom_ratio_hoogte: customH },
      title: String(cfg.title || "Notities"),
      pagesCount,
      bookmarks,
    };
  };

  const applyLayout = () => {
    if (!bookEl) return;
    const pagesEl = bookEl.querySelector(".book__pages");
    if (!pagesEl) return;

    const layout = state.config?.layout && typeof state.config.layout === "object" ? state.config.layout : {};
    const format = String(layout.formaat || "Standaard");

    const maybeMaxWidth = layout.max_breedte_px != null ? Number(layout.max_breedte_px) : null;
    if (Number.isFinite(maybeMaxWidth) && maybeMaxWidth > 0) {
      bookEl.style.setProperty("--book-max-width", `${Math.round(maybeMaxWidth)}px`);
    } else if (format === "A5" || format === "A5-landscape") {
      // A5 is meestal kleiner; houd hem compacter op grote schermen.
      bookEl.style.setProperty("--book-max-width", "760px");
    } else {
      bookEl.style.removeProperty("--book-max-width");
    }

    const setAspect = (w, h) => {
      const ww = Number(w);
      const hh = Number(h);
      if (!Number.isFinite(ww) || !Number.isFinite(hh) || ww <= 0 || hh <= 0) return;
      pagesEl.style.setProperty("--page-aspect", `${ww} / ${hh}`);
    };

    // Default aspect-ratio staat in CSS (iets hoger dan voorheen).
    pagesEl.style.removeProperty("--page-aspect");

    if (format === "A4" || format === "A5") setAspect(1, 1.4142);
    if (format === "A4-landscape" || format === "A5-landscape") setAspect(1.4142, 1);
    if (format === "Custom") {
      const w = layout.custom_ratio_breedte;
      const h = layout.custom_ratio_hoogte;
      if (w != null && h != null) setAspect(w, h);
    }
  };

  const getNotebook = async (id) => {
    const db = state.db;
    const tx = db.transaction(["notebooks"], "readonly");
    return txGet(tx.objectStore("notebooks"), id);
  };

  const putNotebook = async (nb) => {
    const db = state.db;
    const tx = db.transaction(["notebooks"], "readwrite");
    await txPut(tx.objectStore("notebooks"), nb);
    return nb;
  };

  const getPage = async (id, pageIndex) => {
    const db = state.db;
    const key = makePageKey(id, pageIndex);
    const tx = db.transaction(["pages"], "readonly");
    return txGet(tx.objectStore("pages"), key);
  };

  const putPage = async (page) => {
    const db = state.db;
    const tx = db.transaction(["pages"], "readwrite");
    await txPut(tx.objectStore("pages"), page);
    return page;
  };

  const getBookmarks = async (id) => {
    const db = state.db;
    const tx = db.transaction(["bookmarks"], "readonly");
    return txGetAllByIndex(tx.objectStore("bookmarks"), "byNotebook", id);
  };

  const putBookmark = async (bm) => {
    const db = state.db;
    const tx = db.transaction(["bookmarks"], "readwrite");
    await txPut(tx.objectStore("bookmarks"), bm);
    return bm;
  };

  const getAllPages = async (id) => {
    const db = state.db;
    const tx = db.transaction(["pages"], "readonly");
    const store = tx.objectStore("pages");
    const pages = [];
    await txScanAll(store, (row) => {
      if (row && row.id === id) pages.push(row);
    });
    pages.sort((a, b) => Number(a.pageIndex || 0) - Number(b.pageIndex || 0));
    return pages;
  };

  const toExportBookmark = (bm) => ({
    bookmarkId: String(bm.bookmarkId || ""),
    name: String(bm.name || ""),
    pageIndex: Number(bm.pageIndex || 0),
    slot: Number(bm.slot || 0),
    strokes: Array.isArray(bm.strokes) ? bm.strokes : [],
    preset: Boolean(bm.preset),
    createdAt: bm.createdAt || null,
    updatedAt: bm.updatedAt || null,
  });

  const toExportPage = (p) => ({
    pageIndex: Number(p.pageIndex || 0),
    text: String(p.text || ""),
    strokes: Array.isArray(p.strokes) ? p.strokes : [],
    updatedAt: p.updatedAt || null,
  });

  const downloadNotebook = async () => {
    try {
      if (!state.db) throw new Error("Database is nog niet geladen.");
      if (!notebookId) throw new Error("missing notitieblok_id");
      if (!state.notebook) throw new Error("Notitieblok is nog niet geladen.");

      const pagesFromDb = await getAllPages(notebookId);
      const pages = pagesFromDb.map(toExportPage);

      // Zorg dat de huidige pagina altijd de nieuwste in-memory waarde heeft.
      const current = {
        pageIndex: Number(state.front?.pageIndex || 0),
        text: String(state.front?.text?.value || ""),
        strokes: Array.isArray(state.front?.strokes) ? state.front.strokes : [],
        updatedAt: nowIso(),
      };
      const idx = pages.findIndex((p) => p.pageIndex === current.pageIndex);
      if (idx >= 0) pages[idx] = current;
      else pages.push(current);
      pages.sort((a, b) => Number(a.pageIndex || 0) - Number(b.pageIndex || 0));

      const exportObj = {
        tool: "notities",
        version: "v1",
        exportedAt: nowIso(),
        notitieblok_id: notebookId,
        notebook: {
          id: state.notebook.id,
          title: state.notebook.title,
          pagesCount: state.notebook.pagesCount,
          lastPageIndex: state.notebook.lastPageIndex,
          createdAt: state.notebook.createdAt || null,
          updatedAt: state.notebook.updatedAt || null,
        },
        settings: {
          title: state.config?.title || "Notities",
          pagesCount: Number(state.config?.pagesCount || state.notebook.pagesCount || 100),
          bookmarks: Array.isArray(state.config?.bookmarks) ? state.config.bookmarks : [],
        },
        bookmarks: Array.isArray(state.bookmarks) ? state.bookmarks.map(toExportBookmark) : [],
        pages,
      };

      const safeId = String(notebookId).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80) || "notitieblok";
      const date = new Date().toISOString().slice(0, 10);
      const fileName = `notities_${safeId}_${date}.json`;

      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setHint("");
    } catch (e) {
      setHint(`Download mislukt: ${String(e.message || e)}`, "error");
    }
  };

  const ensureNotebook = async () => {
    if (!notebookId) {
      setHint("notitieblok_id is verplicht (of gebruik unique_id). Geef het mee via querystring of in de JSON-config. Voorbeeld: ?notitieblok_id=...&data=.../example.json", "error");
      throw new Error("missing notitieblok_id");
    }

    let nb = await getNotebook(notebookId);
    if (nb) {
      // Als config meer pagina's heeft gekregen, alleen uitbreiden (niet inkorten/verplaatsen).
      const cfgCount = Number(state.config.pagesCount || 100);
      if (cfgCount > Number(nb.pagesCount || 0)) {
        nb.pagesCount = cfgCount;
        nb.updatedAt = nowIso();
        await putNotebook(nb);
      }
      return nb;
    }

    const pagesCount = Number(state.config.pagesCount || 100);
    nb = {
      id: notebookId,
      title: String(state.config.title || "Notities"),
      pagesCount,
      lastPageIndex: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await putNotebook(nb);

    // Preset bookmarks: gelijkmatig verdelen over pagina's + vaste slots.
    const preset = Array.isArray(state.config.bookmarks) ? state.config.bookmarks : [];
    const names = preset.map((b) => String(b.name || "").trim()).filter(Boolean);
    const n = names.length;
    if (n > 0) {
      const step = Math.max(1, Math.floor(pagesCount / (n + 1)));
      const slots = 12;
      const slotStep = Math.max(1, Math.floor(slots / (n + 1)));
      for (let i = 0; i < n; i++) {
        const pageIndex = clamp(step * (i + 1), 0, pagesCount - 1);
        const slot = clamp(slotStep * (i + 1), 0, slots - 1);
        const bookmarkId = makeBookmarkId();
        await putBookmark({
          key: makeBookmarkKey(notebookId, bookmarkId),
          id: notebookId,
          bookmarkId,
          name: names[i],
          pageIndex,
          slot,
          strokes: [],
          preset: true,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
      }
    }

    return nb;
  };

  const setViewData = (view, pageIndex, pageData) => {
    view.pageIndex = pageIndex;
    updateViewTab(view);
    view.text.value = String(pageData?.text || "");
    view.strokes = Array.isArray(pageData?.strokes) ? pageData.strokes : [];
  };

  const saveNotebookLastPage = debounce(async (pageIndex) => {
    try {
      if (!state.notebook) return;
      const nb = { ...state.notebook, lastPageIndex: pageIndex, updatedAt: nowIso() };
      await putNotebook(nb);
      state.notebook = nb;
    } catch (_) {}
  }, 250);

  const savePageDebounced = debounce(async (view) => {
    try {
      const id = notebookId;
      const key = makePageKey(id, view.pageIndex);
      await putPage({
        key,
        id,
        pageIndex: view.pageIndex,
        text: String(view.text.value || ""),
        strokes: Array.isArray(view.strokes) ? view.strokes : [],
        updatedAt: nowIso(),
      });
      saveNotebookLastPage(view.pageIndex);
    } catch (_) {}
  }, 350);

  const redrawAll = () => {
    state.front.canvasCtl && state.front.canvasCtl.redraw();
    state.back.canvasCtl && state.back.canvasCtl.redraw();
    state.bookmarkCanvases.forEach((c) => c.redraw());
  };

  const renderBookmarks = () => {
    bookmarksEl.innerHTML = "";
    const slots = 12;
    bookmarksEl.style.setProperty("--slots", String(slots));

    const usedSlots = new Set();
    state.bookmarks.forEach((b) => usedSlots.add(Number(b.slot)));

    state.bookmarkCanvases = [];

    state.bookmarks
      .slice()
      .sort((a, b) => {
        const sa = Number(a.slot ?? 9999);
        const sb = Number(b.slot ?? 9999);
        if (sa !== sb) return sa - sb;
        return String(a.name).localeCompare(String(b.name));
      })
      .forEach((bm) => {
        const denom = Math.max(1, slots - 1);
        const el = document.createElement("button");
        el.type = "button";
        el.className = "bookmark";
        el.dataset.preset = bm.preset ? "true" : "false";
        el.style.top = `calc((${Number(bm.slot) || 0} / ${denom}) * (100% - var(--bh)))`;
        el.title = `Ga naar pagina ${Number(bm.pageIndex) + 1}`;

        const canvas = document.createElement("canvas");
        canvas.className = "bookmark__canvas";
        el.appendChild(canvas);

        const label = document.createElement("span");
        label.className = "bookmark__label";
        label.textContent = String(bm.name || "");
        el.appendChild(label);

        const isThisPenMode = () => isPenMode();
        const getStrokes = () => (Array.isArray(bm.strokes) ? bm.strokes : []);
        const setStrokes = (st) => {
          bm.strokes = st;
        };

        const saveBookmark = debounce(async () => {
          try {
            await putBookmark({ ...bm, updatedAt: nowIso() });
          } catch (_) {}
        }, 400);

        const canvasCtl = setupCanvas(
          canvas,
          getStrokes,
          setStrokes,
          isThisPenMode,
          () => saveBookmark()
        );
        state.bookmarkCanvases.push(canvasCtl);

        el.addEventListener("click", () => {
          if (isPenMode()) return;
          jumpToPage(Number(bm.pageIndex) || 0);
        });

        bookmarksEl.appendChild(el);
      });

    // Update tab label(s) because bookmarks may have changed (init/add).
    updateViewTab(state.front);
    updateViewTab(state.back);
  };

  const flushSaves = async () => {
    try {
      savePageDebounced.flush();
      saveNotebookLastPage.flush();
    } catch (_) {}
  };

  const loadPageIntoView = async (view, pageIndex) => {
    const id = notebookId;
    const existing = await getPage(id, pageIndex);
    setViewData(view, pageIndex, existing || { text: "", strokes: [] });
  };

  const doTurn = async (direction, targetIndex) => {
    if (state.animating) return;
    state.animating = true;
    updateHeader();

    await flushSaves();

    await loadPageIntoView(state.back, targetIndex);
    state.back.canvasCtl && state.back.canvasCtl.redraw();

    setActiveViewInteractivity();

    const cls = direction === "forward" ? "page--turn-forward" : "page--turn-back";
    const onDone = () => {
      state.front.root.removeEventListener("animationend", onDone);
      state.front.root.classList.remove(cls);

      const tmp = state.front;
      state.front = state.back;
      state.back = tmp;

      // swap DOM z-index roles via classes
      state.front.root.classList.add("page--front");
      state.front.root.classList.remove("page--back");
      state.back.root.classList.add("page--back");
      state.back.root.classList.remove("page--front");

      state.currentPageIndex = targetIndex;
      saveNotebookLastPage(targetIndex);

      setActiveViewInteractivity();
      updateHeader();
      state.animating = false;
    };

    state.front.root.classList.add(cls);
    state.front.root.addEventListener("animationend", onDone);
  };

  const jumpToPage = async (pageIndex) => {
    const pagesCount = Number(state.notebook?.pagesCount || state.config.pagesCount || 100);
    const target = clamp(Number(pageIndex) || 0, 0, pagesCount - 1);
    if (target === state.currentPageIndex) return;
    const dir = target > state.currentPageIndex ? "forward" : "back";
    await doTurn(dir === "forward" ? "forward" : "back", target);
  };

  const goPrev = () => jumpToPage(state.currentPageIndex - 1);
  const goNext = () => jumpToPage(state.currentPageIndex + 1);

  const addUserBookmark = async () => {
    const name = window.prompt("Naam van bookmark?");
    const trimmed = String(name || "").trim();
    if (!trimmed) return;

    const usedSlots = new Set(state.bookmarks.map((b) => Number(b.slot)));
    const slots = 12;
    let slot = 0;
    while (slot < slots && usedSlots.has(slot)) slot++;

    const bookmarkId = makeBookmarkId();
    const bm = {
      key: makeBookmarkKey(notebookId, bookmarkId),
      id: notebookId,
      bookmarkId,
      name: trimmed,
      pageIndex: state.currentPageIndex,
      slot: slot < slots ? slot : state.bookmarks.length,
      strokes: [],
      preset: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await putBookmark(bm);
    state.bookmarks.push(bm);
    renderBookmarks();
    redrawAll();
  };

  const initEvents = () => {
    prevBtn && prevBtn.addEventListener("click", goPrev);
    nextBtn && nextBtn.addEventListener("click", goNext);
    downloadBtn && downloadBtn.addEventListener("click", downloadNotebook);

    modeBtn &&
      modeBtn.addEventListener("click", () => {
        setMode(state.mode === "pen" ? "type" : "pen");
        setHint(state.mode === "pen" ? "Penmodus: teken op de pagina (of op een bookmark)." : "Typmodus: schrijf tekst op de pagina.");
      });

    clearBtn &&
      clearBtn.addEventListener("click", () => {
        if (!confirm("Tekening op deze pagina wissen?")) return;
        state.front.canvasCtl && state.front.canvasCtl.clear();
      });

    addBookmarkBtn && addBookmarkBtn.addEventListener("click", addUserBookmark);

    state.front.text.addEventListener("input", () => savePageDebounced(state.front));
    state.back.text.addEventListener("input", () => savePageDebounced(state.back));

    window.addEventListener("keydown", (e) => {
      if (state.animating) return;
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    });
  };

  const init = async () => {
    try {
      if (!("indexedDB" in window)) {
        setHint("Je browser ondersteunt geen IndexedDB; opslag werkt niet.", "error");
        return;
      }

      state.db = await openDb();
      state.config = await loadConfig();
      applyLayout();

      if (!notebookId && state.config?.notitieblok_id) {
        notebookId = String(state.config.notitieblok_id || "").trim();
      }

      state.notebook = await ensureNotebook();
      state.bookmarks = await getBookmarks(notebookId);
      downloadBtn && (downloadBtn.disabled = false);

      // init page views
      state.front.root.classList.add("page--front");
      state.front.root.classList.remove("page--back");
      state.back.root.classList.add("page--back");
      state.back.root.classList.remove("page--front");

      state.currentPageIndex = clamp(Number(state.notebook.lastPageIndex || 0), 0, Number(state.notebook.pagesCount || 100) - 1);

      await loadPageIntoView(state.front, state.currentPageIndex);
      await loadPageIntoView(state.back, state.currentPageIndex);

      viewA.canvasCtl = setupCanvas(
        viewA.canvas,
        () => viewA.strokes,
        (st) => { viewA.strokes = st; },
        () => isPenMode() && state.front === viewA,
        () => savePageDebounced(viewA)
      );

      viewB.canvasCtl = setupCanvas(
        viewB.canvas,
        () => viewB.strokes,
        (st) => { viewB.strokes = st; },
        () => isPenMode() && state.front === viewB,
        () => savePageDebounced(viewB)
      );

      renderBookmarks();
      initEvents();
      setActiveViewInteractivity();
      updateHeader();

      setHint("");
      redrawAll();
    } catch (e) {
      setHint(`Starten mislukt: ${String(e.message || e)}`, "error");
    }
  };

  init();
})();
