const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data");
const uniqueId = params.get("unique_id");

const poolEl = document.getElementById("pool");
const slotsEl = document.getElementById("slots");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const toolTitleEl = document.getElementById("tool-title");
const subtitleEl = document.getElementById("subtitle");
const descriptionEl = document.getElementById("description");
const checkBtn = document.getElementById("check");

let regels = [];
let regelsById = new Map();
let correctOrder = [];
let slots = [];
let pool = [];
let showCheck = true;
let showCorrectOnCheck = true;
let completion = null;

let draggedId = null;
let dragSource = null;
let dragSourceSlot = null;
let draggedEl = null;

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "status error" : "status";
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clearResultFeedback() {
  resultEl.textContent = "";
  Array.from(slotsEl.querySelectorAll(".slot")).forEach((slotEl) => {
    slotEl.classList.remove("correct", "incorrect", "is-dragover");
  });
}

function createCodeLineEl(id) {
  const regel = regelsById.get(id);
  const lineEl = document.createElement("div");
  lineEl.className = "code-line";
  lineEl.draggable = true;
  lineEl.dataset.id = id;

  const handleEl = document.createElement("span");
  handleEl.className = "code-line__handle";
  handleEl.setAttribute("aria-hidden", "true");
  handleEl.textContent = "⇅";

  const codeEl = document.createElement("code");
  codeEl.textContent = regel?.code ?? "";

  lineEl.append(handleEl, codeEl);
  return lineEl;
}

function render() {
  poolEl.innerHTML = "";
  if (pool.length === 0) {
    const empty = document.createElement("li");
    empty.className = "slot";
    empty.innerHTML = '<div class="slot__drop is-empty">Geen regels meer links</div>';
    poolEl.appendChild(empty);
  } else {
    pool.forEach((id) => {
      const li = document.createElement("li");
      li.appendChild(createCodeLineEl(id));
      poolEl.appendChild(li);
    });
  }

  slotsEl.innerHTML = "";
  for (let i = 0; i < slots.length; i += 1) {
    const li = document.createElement("li");
    li.className = "slot";
    li.dataset.slot = String(i);

    const label = document.createElement("div");
    label.className = "slot__label";
    label.textContent = `Regel ${i + 1}`;

    const drop = document.createElement("div");
    drop.className = "slot__drop";
    drop.dataset.slot = String(i);

    const id = slots[i];
    if (id) {
      drop.appendChild(createCodeLineEl(id));
    } else {
      drop.classList.add("is-empty");
      drop.textContent = "Sleep hier een regel";
    }

    li.append(label, drop);
    slotsEl.appendChild(li);
  }
}

function clearDragState() {
  draggedId = null;
  dragSource = null;
  dragSourceSlot = null;
  if (draggedEl) {
    draggedEl.classList.remove("dragging");
  }
  draggedEl = null;
}

function handleDragStart(e, source) {
  const lineEl = e.target?.closest?.(".code-line");
  if (!lineEl) return;
  draggedId = lineEl.dataset.id || null;
  if (!draggedId) return;
  dragSource = source;
  draggedEl = lineEl;
  dragSourceSlot = source === "slot" ? Number(lineEl.closest("[data-slot]")?.dataset.slot) : null;
  e.dataTransfer.setData("text/plain", draggedId);
  e.dataTransfer.effectAllowed = "move";
  requestAnimationFrame(() => {
    if (draggedEl) draggedEl.classList.add("dragging");
  });
}

function moveDraggedToSlot(targetSlot) {
  if (!draggedId) return;
  const targetId = slots[targetSlot];

  if (dragSource === "slot") {
    if (dragSourceSlot === targetSlot) {
      return;
    }
    slots[targetSlot] = draggedId;
    slots[dragSourceSlot] = targetId || null;
  } else if (dragSource === "pool") {
    const poolIndex = pool.indexOf(draggedId);
    if (poolIndex !== -1) {
      pool.splice(poolIndex, 1);
    }
    slots[targetSlot] = draggedId;
    if (targetId) {
      pool.push(targetId);
    }
  }

  render();
  clearResultFeedback();
  if (!showCheck) {
    updateResult();
    markCorrectness();
  }
}

function moveDraggedToPool() {
  if (!draggedId || dragSource !== "slot") return;
  if (dragSourceSlot == null) return;

  const id = slots[dragSourceSlot];
  if (!id) return;

  slots[dragSourceSlot] = null;
  if (!pool.includes(id)) {
    pool.push(id);
  }

  render();
  clearResultFeedback();
  if (!showCheck) {
    updateResult();
    markCorrectness();
  }
}

function updateResult() {
  const isCorrect = slots.length === correctOrder.length && slots.every((id, index) => id === correctOrder[index]);
  resultEl.textContent = isCorrect ? "Goed gedaan! Het programma staat in de juiste volgorde." : "Nog niet helemaal.";

  if (isCorrect) {
    completion?.markCompleted?.({
      score: { correct: correctOrder.length, total: correctOrder.length },
    });
  }
  return isCorrect;
}

function markCorrectness() {
  if (!showCorrectOnCheck) return;
  Array.from(slotsEl.querySelectorAll(".slot")).forEach((slotEl, index) => {
    slotEl.classList.remove("correct", "incorrect");
    if (slots[index] === correctOrder[index]) {
      slotEl.classList.add("correct");
    } else {
      slotEl.classList.add("incorrect");
    }
  });
}

function normalizeData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Data moet een object zijn.");
  }

  if (!Array.isArray(data.regels)) {
    throw new Error("`regels` ontbreekt of is geen array.");
  }

  const seenIds = new Set();
  const normalizedRegels = data.regels.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Regel ${index + 1} is geen object.`);
    }

    const code = typeof item.code === "string" ? item.code : "";
    if (!code.trim()) {
      throw new Error(`Regel ${index + 1} mist een geldige \`code\`-tekst.`);
    }

    const rawId = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `regel-${index + 1}`;
    if (seenIds.has(rawId)) {
      throw new Error(`Dubbele regel-id gevonden: ${rawId}`);
    }
    seenIds.add(rawId);

    let positie = null;
    if (item.positie !== undefined && item.positie !== null && item.positie !== "") {
      if (!Number.isInteger(item.positie) || item.positie < 1) {
        throw new Error(`Regel ${index + 1} heeft een ongeldige \`positie\`. Gebruik 1, 2, 3... of laat leeg.`);
      }
      positie = item.positie;
    }

    return {
      id: rawId,
      code,
      positie,
    };
  });

  const geordendeRegels = normalizedRegels.filter((regel) => regel.positie !== null);
  if (geordendeRegels.length < 2) {
    throw new Error("Voeg minimaal 2 regels met een ingevulde `positie` toe.");
  }

  const gebruiktePosities = geordendeRegels.map((regel) => regel.positie);
  const uniekePosities = new Set(gebruiktePosities);
  if (uniekePosities.size !== gebruiktePosities.length) {
    throw new Error("Elke ingevulde `positie` moet uniek zijn.");
  }

  const sortedPosities = gebruiktePosities.slice().sort((a, b) => a - b);
  sortedPosities.forEach((positie, index) => {
    const expected = index + 1;
    if (positie !== expected) {
      throw new Error("Posities moeten oplopend en aaneengesloten zijn: 1, 2, 3, ...");
    }
  });

  return {
    toolTitle:
      typeof data.toolTitle === "string" && data.toolTitle.trim()
        ? data.toolTitle.trim()
        : "Code in volgorde zetten",
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Code in volgorde zetten",
    description: typeof data.description === "string" ? data.description : "",
    shuffle: data.shuffle !== false,
    showCheck: data.showCheck !== false,
    showCorrectOnCheck: data.showCorrectOnCheck !== false,
    regels: normalizedRegels,
    correctOrder: geordendeRegels.sort((a, b) => a.positie - b.positie).map((regel) => regel.id),
  };
}

function attachDnD() {
  poolEl.addEventListener("dragstart", (e) => handleDragStart(e, "pool"));
  slotsEl.addEventListener("dragstart", (e) => handleDragStart(e, "slot"));

  document.addEventListener("dragend", () => {
    clearDragState();
    poolEl.classList.remove("is-dragover");
    Array.from(slotsEl.querySelectorAll(".slot, .slot__drop")).forEach((el) => el.classList.remove("is-dragover"));
  });

  poolEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    poolEl.classList.add("is-dragover");
  });

  poolEl.addEventListener("dragleave", (e) => {
    if (!poolEl.contains(e.relatedTarget)) {
      poolEl.classList.remove("is-dragover");
    }
  });

  poolEl.addEventListener("drop", (e) => {
    e.preventDefault();
    poolEl.classList.remove("is-dragover");
    moveDraggedToPool();
    clearDragState();
  });

  slotsEl.addEventListener("dragover", (e) => {
    const dropTarget = e.target.closest(".slot__drop[data-slot]");
    if (!dropTarget) return;
    e.preventDefault();
    Array.from(slotsEl.querySelectorAll(".slot__drop")).forEach((el) => el.classList.remove("is-dragover"));
    dropTarget.classList.add("is-dragover");
    dropTarget.closest(".slot")?.classList.add("is-dragover");
  });

  slotsEl.addEventListener("dragleave", (e) => {
    const dropTarget = e.target.closest(".slot__drop[data-slot]");
    if (!dropTarget) return;
    if (dropTarget.contains(e.relatedTarget)) return;
    dropTarget.classList.remove("is-dragover");
    dropTarget.closest(".slot")?.classList.remove("is-dragover");
  });

  slotsEl.addEventListener("drop", (e) => {
    const dropTarget = e.target.closest(".slot__drop[data-slot]");
    if (!dropTarget) return;
    e.preventDefault();
    const slotIndex = Number(dropTarget.dataset.slot);
    moveDraggedToSlot(slotIndex);
    Array.from(slotsEl.querySelectorAll(".slot, .slot__drop")).forEach((el) => el.classList.remove("is-dragover"));
    clearDragState();
  });
}

async function init() {
  if (!uniqueId) {
    subtitleEl.textContent = "Context ontbreekt";
    setStatus("unique_id is verplicht. Gebruik ?unique_id=...&data=URL-naar-json", true);
    checkBtn.style.display = "none";
    return;
  }
  if (!dataUrl) {
    subtitleEl.textContent = "Data ontbreekt";
    setStatus("Geen data-URL opgegeven. Gebruik ?data=URL-naar-json", true);
    checkBtn.style.display = "none";
    return;
  }

  attachDnD();

  try {
    const res = await fetch(dataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawData = await res.json();
    const data = normalizeData(rawData);

    if (toolTitleEl) {
      toolTitleEl.textContent = data.toolTitle;
    }
    subtitleEl.textContent = data.title;
    if (data.description.trim()) {
      descriptionEl.textContent = data.description;
      descriptionEl.hidden = false;
    }

    regels = data.regels;
    regelsById = new Map(regels.map((regel) => [regel.id, regel]));
    correctOrder = data.correctOrder;
    slots = new Array(correctOrder.length).fill(null);
    pool = (data.shuffle ? shuffle(regels) : regels.slice()).map((regel) => regel.id);
    showCheck = data.showCheck;
    showCorrectOnCheck = data.showCorrectOnCheck;
    checkBtn.style.display = showCheck ? "inline-flex" : "none";

    render();

    const cardEl = document.querySelector(".card");
    completion =
      window.LearningToolsCompletion?.create?.({
        toolId: "code-in-volgorde-zetten",
        version: "v1",
        dataUrl: new URL(dataUrl, window.location.href).toString(),
        uniqueId,
        title: data.title || data.toolTitle || null,
        containerEl: cardEl,
        onReset: () => window.location.reload(),
      }) || null;

    setStatus("Sleep regels van links naar rechts. Laat afleiders links staan als ze niet nodig zijn.");
  } catch (err) {
    console.error(err);
    subtitleEl.textContent = "Fout";
    setStatus(err instanceof Error ? err.message : "Kan data niet laden.", true);
    checkBtn.style.display = "none";
  }
}

checkBtn.addEventListener("click", () => {
  updateResult();
  markCorrectness();
});

init();
