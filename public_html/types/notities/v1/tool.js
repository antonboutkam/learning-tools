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

  const pageFrontEl = document.getElementById("pageFront");
  const pageBackEl = document.getElementById("pageBack");
  const textFrontEl = document.getElementById("textFront");
  const textBackEl = document.getElementById("textBack");
  const inkFrontEl = document.getElementById("inkFront");
  const inkBackEl = document.getElementById("inkBack");
  const bookmarksEl = document.getElementById("bookmarks");

  if (!pageFrontEl || !pageBackEl || !textFrontEl || !textBackEl || !inkFrontEl || !inkBackEl || !bookmarksEl) return;

  const params = new URLSearchParams(window.location.search);
  const dataUrl = params.get("data") || "";
  const notebookIdParam =
    params.get("notitieblok_id") ||
    params.get("notitieblokId") ||
    params.get("notities_id") ||
    params.get("unique_id") ||
    "";

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

  const viewA = { root: pageFrontEl, text: textFrontEl, canvas: inkFrontEl, pageIndex: 0, strokes: [], canvasCtl: null };
  const viewB = { root: pageBackEl, text: textBackEl, canvas: inkBackEl, pageIndex: 0, strokes: [], canvasCtl: null };
  state.front = viewA;
  state.back = viewB;

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
    if (metaEl) metaEl.textContent = notebookIdParam ? `notitieblok_id: ${notebookIdParam}` : "";
    if (prevBtn) prevBtn.disabled = state.animating || state.currentPageIndex <= 0;
    if (nextBtn) nextBtn.disabled = state.animating || state.currentPageIndex >= pagesCount - 1;
  };

  const loadConfig = async () => {
    if (!dataUrl) return { title: "Notities", pagesCount: 100, bookmarks: [] };
    const res = await fetch(String(dataUrl), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const cfg = (json && typeof json === "object") ? json : {};
    const pagesCount = clamp(Number(cfg.pagesCount ?? 100) || 100, 1, 1000);
    const rawBookmarks = Array.isArray(cfg.bookmarks) ? cfg.bookmarks : [];
    const bookmarks = rawBookmarks.map(normalizeBookmarkInput).filter(Boolean);
    return { title: String(cfg.title || "Notities"), pagesCount, bookmarks };
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

  const ensureNotebook = async () => {
    if (!notebookIdParam) {
      setHint("notitieblok_id is verplicht (of gebruik unique_id). Voorbeeld: ?notitieblok_id=...&data=.../example.json", "error");
      throw new Error("missing notitieblok_id");
    }

    let nb = await getNotebook(notebookIdParam);
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
      id: notebookIdParam,
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
          key: makeBookmarkKey(notebookIdParam, bookmarkId),
          id: notebookIdParam,
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
      const id = notebookIdParam;
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
  };

  const flushSaves = async () => {
    try {
      savePageDebounced.flush();
      saveNotebookLastPage.flush();
    } catch (_) {}
  };

  const loadPageIntoView = async (view, pageIndex) => {
    const id = notebookIdParam;
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
      key: makeBookmarkKey(notebookIdParam, bookmarkId),
      id: notebookIdParam,
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

    modeBtn &&
      modeBtn.addEventListener("click", () => {
        setMode(state.mode === "pen" ? "type" : "pen");
        setHint(state.mode === "pen" ? "Penmodus: teken op de pagina (of op een bookmark)." : "Typmodus: schrijf tekst op de pagina.");
      });

    clearBtn &&
      clearBtn.addEventListener("click", () => {
        if (!confirm("Tekening op deze pagina wissen?")) return;
        state.frontCanvas.clear();
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

      state.notebook = await ensureNotebook();
      state.bookmarks = await getBookmarks(notebookIdParam);

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

      setHint('Gebruik `?notitieblok_id=...&data=.../example.json` (of `unique_id`). Je notities blijven bewaard per notitieblok_id.');
      redrawAll();
    } catch (e) {
      setHint(`Starten mislukt: ${String(e.message || e)}`, "error");
    }
  };

  init();
})();
