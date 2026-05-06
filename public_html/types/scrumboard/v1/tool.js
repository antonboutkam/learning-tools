(function () {
  const DEFAULT_COLUMNS = ["Backlog", "Sprint", "Today", "Done"];
  const STORAGE_PREFIX = "learning-tools-scrumboard:";
  const STORAGE_VERSION = 2;

  const params = new URLSearchParams(window.location.search);
  const dataUrl = params.get("data") || "";

  const titleEl = document.getElementById("title");
  const metaEl = document.getElementById("meta");
  const statusEl = document.getElementById("status");
  const boardEl = document.getElementById("board");
  const openFormBtn = document.getElementById("openFormBtn");
  const cancelFormBtn = document.getElementById("cancelFormBtn");
  const composerEl = document.getElementById("composer");
  const formEl = document.getElementById("itemForm");
  const labelEl = document.getElementById("itemLabel");
  const descriptionEl = document.getElementById("itemDescription");
  const urlEl = document.getElementById("itemUrl");
  const pointsEl = document.getElementById("itemPoints");
  const columnEl = document.getElementById("itemColumn");

  let draggedId = null;
  let config = {
    key: "",
    title: "Scrumboard",
    allowStudentItems: true,
    allowStudentDelete: true,
    maxWidth: "",
    columns: DEFAULT_COLUMNS,
    items: [],
  };
  let state = { items: [] };

  const setStatus = (message, kind = "") => {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.className = kind === "error" ? "status error" : "status";
  };

  const escapeKeyPart = (value) => String(value || "").trim().replace(/\s+/g, "-").slice(0, 160);
  const nowId = () => `item_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 8)}`;
  const storageKey = () => `${STORAGE_PREFIX}${escapeKeyPart(config.key)}`;

  const normalizeColumns = (columns) => {
    const names = Array.isArray(columns) ? columns : DEFAULT_COLUMNS;
    const cleaned = names
      .map((name) => String(name || "").trim())
      .filter(Boolean);
    return Array.from(new Set(cleaned)).slice(0, 12);
  };

  const getUrlBase = (url) => {
    const raw = String(url || "").trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) return window.location.href;
    if (document.referrer) return document.referrer;
    return window.location.href;
  };

  const normalizeUrl = (value) => {
    const url = String(value || "").trim();
    if (!url) return "";
    try {
      const parsed = new URL(url, getUrlBase(url));
      return parsed.toString();
    } catch (_) {
      return "";
    }
  };

  const normalizePoints = (value) => {
    if (value === "" || value == null) return null;
    const points = Number(value);
    if (!Number.isFinite(points) || points < 0) return null;
    return Math.round(points);
  };

  const normalizeItem = (item, index, source = "stored") => {
    const columns = config.columns.length ? config.columns : DEFAULT_COLUMNS;
    const fallbackColumn = columns[0];
    const rawColumn = String(item?.column || item?.kolom || fallbackColumn).trim();
    const column = columns.includes(rawColumn) ? rawColumn : fallbackColumn;
    const fallbackId = source === "config" ? `config_${index}` : nowId();
    return {
      id: String(item?.id || fallbackId),
      label: String(item?.label || item?.title || "").trim() || `Item ${index + 1}`,
      description: String(item?.description || item?.beschrijving || "").trim(),
      url: normalizeUrl(item?.url),
      points: normalizePoints(item?.points ?? item?.punten),
      column,
      expanded: Boolean(item?.expanded),
      source: String(item?.source || source),
      createdAt: String(item?.createdAt || new Date().toISOString()),
    };
  };

  const loadConfig = async () => {
    const json = dataUrl
      ? await fetch(dataUrl, { cache: "no-store" }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
      : {};
    const data = json && typeof json === "object" ? json : {};
    const key =
      params.get("scrumboard_key") ||
      params.get("key") ||
      params.get("unique_id") ||
      data.key ||
      data.scrumboard_key ||
      data.unique_id ||
      "";
    const columns = normalizeColumns(data.columns);
    return {
      key: String(key || "").trim(),
      title: String(data.title || "Scrumboard").trim() || "Scrumboard",
      allowStudentItems: data.allowStudentItems !== false,
      allowStudentDelete: data.allowStudentDelete !== false,
      maxWidth: String(data.maxWidth || data.max_breedte || "").trim(),
      columns,
      items: Array.isArray(data.items) ? data.items : [],
    };
  };

  const loadState = () => {
    const initialItems = config.items.map((item, index) => normalizeItem(item, index, "config"));
    if (!config.key) return { items: initialItems };
    try {
      const raw = window.localStorage.getItem(storageKey());
      if (!raw) return { items: initialItems };
      const parsed = JSON.parse(raw);
      if (parsed?.storageVersion !== STORAGE_VERSION) return { items: initialItems };
      const persistedItems = Array.isArray(parsed?.items)
        ? parsed.items.map((item, index) => normalizeItem(item, index, "student"))
        : [];
      const persistedById = new Map(persistedItems.map((item) => [item.id, item]));
      const merged = initialItems.map((item) => {
        const persisted = persistedById.get(item.id);
        if (!persisted) return item;
        persistedById.delete(item.id);
        return {
          ...item,
          column: persisted.column,
          expanded: Boolean(persisted.expanded),
          createdAt: persisted.createdAt || item.createdAt,
        };
      });
      return { items: merged.concat(Array.from(persistedById.values())) };
    } catch (_) {
      return { items: initialItems };
    }
  };

  const saveState = () => {
    if (!config.key) return;
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify({ storageVersion: STORAGE_VERSION, items: state.items }));
    } catch (_) {}
  };

  const applyLayout = () => {
    document.documentElement.style.setProperty("--columns", String(config.columns.length));
    const maxWidth = String(config.maxWidth || "").trim();
    const targetEls = [document.querySelector(".top"), composerEl, boardEl].filter(Boolean);
    targetEls.forEach((el) => {
      el.style.width = "100%";
      if (maxWidth) {
        el.style.maxWidth = /^\d+$/.test(maxWidth) ? `${maxWidth}px` : maxWidth;
      } else {
        el.style.maxWidth = "none";
      }
    });
  };

  const fillColumnSelect = () => {
    columnEl.innerHTML = "";
    config.columns.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      columnEl.appendChild(option);
    });
  };

  const setFormOpen = (open) => {
    if (!config.allowStudentItems) return;
    composerEl.hidden = !open;
    openFormBtn.hidden = open;
    if (open) {
      columnEl.value = config.columns[0] || "";
      labelEl.focus();
    }
  };

  const renderNote = (item) => {
    const note = document.createElement("article");
    note.className = item.expanded ? "note is-expanded" : "note is-collapsed";
    note.draggable = true;
    note.dataset.id = item.id;

    const toggle = document.createElement("button");
    toggle.className = "note__toggle";
    toggle.type = "button";
    toggle.dataset.toggleId = item.id;
    toggle.title = item.expanded ? "Klap kaartje in" : "Klap kaartje uit";
    toggle.setAttribute("aria-label", item.expanded ? "Klap kaartje in" : "Klap kaartje uit");
    toggle.setAttribute("aria-expanded", item.expanded ? "true" : "false");
    note.appendChild(toggle);

    const label = document.createElement("div");
    label.className = "note__label";
    label.textContent = item.label;
    note.appendChild(label);

    if (item.points != null) {
      const points = document.createElement("div");
      points.className = "note__points";
      points.textContent = `${item.points} ${item.points === 1 ? "punt" : "punten"}`;
      note.appendChild(points);
    }

    const body = document.createElement("div");
    body.className = "note__body";

    if (item.description) {
      const description = document.createElement("div");
      description.className = "note__description";
      description.textContent = item.description;
      body.appendChild(description);
    }

    if (item.url) {
      const link = document.createElement("a");
      link.className = "note__link";
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open link";
      body.appendChild(link);
    }

    if (config.allowStudentDelete) {
      const controls = document.createElement("div");
      controls.className = "note__controls";
      const del = document.createElement("button");
      del.className = "note__delete";
      del.type = "button";
      del.dataset.deleteId = item.id;
      del.title = "Verwijder item";
      del.setAttribute("aria-label", "Verwijder item");
      del.textContent = "x";
      controls.appendChild(del);
      body.appendChild(controls);
    }

    note.appendChild(body);
    return note;
  };

  const render = () => {
    boardEl.innerHTML = "";
    config.columns.forEach((column) => {
      const section = document.createElement("section");
      section.className = "column";
      section.dataset.column = column;

      const header = document.createElement("div");
      header.className = "column__header";
      header.textContent = column;
      section.appendChild(header);

      const dropzone = document.createElement("div");
      dropzone.className = "column__dropzone";
      dropzone.dataset.column = column;
      state.items
        .filter((item) => item.column === column)
        .forEach((item) => dropzone.appendChild(renderNote(item)));
      section.appendChild(dropzone);

      boardEl.appendChild(section);
    });
    metaEl.textContent = "";
  };

  const moveItemToColumn = (id, column) => {
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item || !config.columns.includes(column)) return;
    item.column = column;
    saveState();
    render();
  };

  boardEl.addEventListener("dragstart", (event) => {
    if (event.target?.closest?.("button, a, input, textarea, select")) return;
    const note = event.target?.closest?.(".note");
    if (!note) return;
    draggedId = note.dataset.id || null;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedId || "");
    requestAnimationFrame(() => note.classList.add("dragging"));
  });

  boardEl.addEventListener("dragend", (event) => {
    event.target?.closest?.(".note")?.classList.remove("dragging");
    draggedId = null;
    boardEl.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
  });

  boardEl.addEventListener("dragover", (event) => {
    const zone = event.target?.closest?.(".column__dropzone");
    if (!zone) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    boardEl.querySelectorAll(".drag-over").forEach((el) => {
      if (el !== zone) el.classList.remove("drag-over");
    });
    zone.classList.add("drag-over");
  });

  boardEl.addEventListener("dragleave", (event) => {
    const zone = event.target?.closest?.(".column__dropzone");
    if (!zone || zone.contains(event.relatedTarget)) return;
    zone.classList.remove("drag-over");
  });

  boardEl.addEventListener("drop", (event) => {
    const zone = event.target?.closest?.(".column__dropzone");
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove("drag-over");
    const id = draggedId || event.dataTransfer.getData("text/plain");
    moveItemToColumn(id, zone.dataset.column || "");
  });

  boardEl.addEventListener("click", (event) => {
    const toggleBtn = event.target?.closest?.("[data-toggle-id]");
    if (toggleBtn) {
      const item = state.items.find((candidate) => candidate.id === toggleBtn.dataset.toggleId);
      if (!item) return;
      item.expanded = !item.expanded;
      saveState();
      render();
      return;
    }

    const btn = event.target?.closest?.("[data-delete-id]");
    if (!btn || !config.allowStudentDelete) return;
    const id = btn.dataset.deleteId;
    state.items = state.items.filter((item) => item.id !== id);
    saveState();
    render();
  });

  openFormBtn.addEventListener("click", () => setFormOpen(true));
  cancelFormBtn.addEventListener("click", () => setFormOpen(false));

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    const item = normalizeItem({
      id: nowId(),
      label: labelEl.value,
      description: descriptionEl.value,
      url: urlEl.value,
      points: pointsEl.value,
      column: columnEl.value || config.columns[0],
      source: "student",
    }, state.items.length, "student");
    state.items.push(item);
    saveState();
    formEl.reset();
    setFormOpen(false);
    render();
  });

  async function init() {
    try {
      config = await loadConfig();
      if (!config.columns.length) config.columns = DEFAULT_COLUMNS.slice();
      if (!config.key) {
        setStatus("key is verplicht. Geef `key` mee in de JSON-config of querystring.", "error");
      }
      titleEl.textContent = config.title;
      openFormBtn.hidden = !config.allowStudentItems;
      fillColumnSelect();
      applyLayout();
      state = loadState();
      render();
    } catch (err) {
      console.error(err);
      titleEl.textContent = "Scrumboard";
      openFormBtn.hidden = true;
      setStatus("Kan scrumboard niet laden. Controleer de data-URL en JSON-config.", "error");
    }
  }

  init();
})();
