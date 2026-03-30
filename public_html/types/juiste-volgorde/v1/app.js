const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data");
const uniqueId = params.get("unique_id");

const listEl = document.getElementById("list");
const mediaEl = document.getElementById("media");
const poolWrapEl = document.getElementById("poolWrap");
const poolEl = document.getElementById("pool");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const subtitleEl = document.getElementById("subtitle");
const checkBtn = document.getElementById("check");

let items = [];
let correctOrder = [];
let showCheck = true;
let showCorrectOnCheck = true;
let completion = null;
let initialState = "re-order";
let itemsById = new Map();
let slots = [];
let pool = [];
let draggedEl = null;
let placeholderEl = null;
let dragSource = null;
let dragSourceSlot = null;

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

function render() {
  listEl.innerHTML = "";
  if (initialState === "empty") {
    poolWrapEl.hidden = false;
    slots.forEach((id, index) => {
      const li = document.createElement("li");
      li.className = "slot";
      li.dataset.slot = String(index);
      if (id) {
        const item = itemsById.get(id);
        li.draggable = true;
        li.dataset.id = id;
        li.innerHTML = `
          <span class="handle">⇅</span>
          <span>${item?.text ?? ""}</span>
        `;
      } else {
        li.classList.add("empty");
        li.innerHTML = "<span>Sleep hier een optie</span>";
      }
      listEl.appendChild(li);
    });
    poolEl.innerHTML = "";
    pool.forEach((id) => {
      const item = itemsById.get(id);
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.id = id;
      li.innerHTML = `
        <span class="handle">⇅</span>
        <span>${item?.text ?? ""}</span>
      `;
      poolEl.appendChild(li);
    });
    return;
  }
  poolWrapEl.hidden = true;
  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.id = item.id;
    li.innerHTML = `
      <span class="handle">⇅</span>
      <span>${item.text}</span>
      <span class="controls">
        <button type="button" data-dir="up" data-index="${index}">▲</button>
        <button type="button" data-dir="down" data-index="${index}">▼</button>
      </span>
    `;
    listEl.appendChild(li);
  });
}

function renderImage(imageUrl, imageAlt, imageCaption) {
  if (!mediaEl) return;
  if (!imageUrl) {
    mediaEl.hidden = true;
    mediaEl.innerHTML = "";
    return;
  }
  const figure = document.createElement("figure");
  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = imageAlt || "";
  img.loading = "lazy";
  img.decoding = "async";
  figure.appendChild(img);
  if (imageCaption) {
    const caption = document.createElement("figcaption");
    caption.textContent = imageCaption;
    figure.appendChild(caption);
  }
  mediaEl.innerHTML = "";
  mediaEl.appendChild(figure);
  mediaEl.hidden = false;
}

function getDragAfterElement(container, y) {
  const els = Array.from(container.querySelectorAll("li:not(.placeholder):not(.dragging)"));
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  els.forEach((el) => {
    const box = el.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: el };
    }
  });
  return closest.element;
}

function createPlaceholder(height) {
  const li = document.createElement("li");
  li.className = "placeholder";
  li.style.height = `${height}px`;
  return li;
}

function clearDragState() {
  draggedId = null;
  draggedEl = null;
  placeholderEl = null;
  dragSource = null;
  dragSourceSlot = null;
}

function handleEmptyDragStart(e, source) {
  const li = e.target?.closest?.("li") || null;
  const id = li?.dataset?.id || null;
  if (!id || !li) return;
  draggedId = id;
  draggedEl = li;
  dragSource = source;
  dragSourceSlot = source === "slot" ? Number(li.dataset.slot) : null;
  e.dataTransfer.setData("text/plain", draggedId);
  e.dataTransfer.effectAllowed = "move";
  requestAnimationFrame(() => {
    if (!draggedEl) return;
    draggedEl.classList.add("dragging");
  });
}

function handleEmptyDropOnSlot(targetIndex) {
  const targetId = slots[targetIndex];
  if (dragSource === "slot") {
    if (dragSourceSlot === targetIndex) return;
    slots[targetIndex] = draggedId;
    slots[dragSourceSlot] = targetId || null;
  } else if (dragSource === "pool") {
    const poolIndex = pool.indexOf(draggedId);
    if (poolIndex !== -1) pool.splice(poolIndex, 1);
    slots[targetIndex] = draggedId;
    if (targetId) pool.push(targetId);
  }
  render();
  clearDragState();
}

function handleEmptyDropOnPool() {
  if (dragSource === "slot") {
    slots[dragSourceSlot] = null;
    pool.push(draggedId);
    render();
  }
  clearDragState();
}

function updateResult() {
  const orderIds = initialState === "empty" ? slots : items.map((item) => item.id);
  const isCorrect = orderIds.length === correctOrder.length && orderIds.every((id, idx) => id === correctOrder[idx]);
  resultEl.textContent = isCorrect ? "Alles staat goed!" : "Nog niet helemaal.";
  if (isCorrect) {
    completion?.markCompleted({ score: { correct: correctOrder.length, total: correctOrder.length } });
  }
  return isCorrect;
}

function markCorrectness() {
  const liEls = Array.from(listEl.querySelectorAll("li"));
  const orderIds = initialState === "empty" ? slots : items.map((item) => item.id);
  liEls.forEach((li, idx) => {
    li.classList.remove("correct", "incorrect");
    if (!showCorrectOnCheck) return;
    const slotIndex = initialState === "empty" ? Number(li.dataset.slot) : idx;
    if (orderIds[slotIndex] === correctOrder[slotIndex]) {
      li.classList.add("correct");
    } else {
      li.classList.add("incorrect");
    }
  });
}

function moveItem(index, dir) {
  if (initialState !== "re-order") return;
  const newIndex = dir === "up" ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= items.length) return;
  const copy = items.slice();
  const [moved] = copy.splice(index, 1);
  copy.splice(newIndex, 0, moved);
  items = copy;
  render();
}

let draggedId = null;
listEl.addEventListener("dragstart", (e) => {
  if (initialState === "empty") {
    handleEmptyDragStart(e, "slot");
    return;
  }
  const li = e.target?.closest?.("li") || null;
  draggedId = li?.dataset?.id || null;
  if (!draggedId || !li) return;
  draggedEl = li;
  const rect = li.getBoundingClientRect();
  placeholderEl = createPlaceholder(rect.height);
  listEl.insertBefore(placeholderEl, li);
  e.dataTransfer.setData("text/plain", draggedId);
  e.dataTransfer.effectAllowed = "move";
  requestAnimationFrame(() => {
    if (!draggedEl) return;
    draggedEl.classList.add("dragging");
    draggedEl.style.display = "none";
  });
});

listEl.addEventListener("dragover", (e) => {
  if (initialState === "empty") {
    e.preventDefault();
    return;
  }
  e.preventDefault();
  if (!placeholderEl) return;
  const afterEl = getDragAfterElement(listEl, e.clientY);
  if (afterEl == null) {
    listEl.appendChild(placeholderEl);
  } else {
    listEl.insertBefore(placeholderEl, afterEl);
  }
});

listEl.addEventListener("drop", (e) => {
  if (initialState === "empty") {
    e.preventDefault();
    const slotEl = e.target.closest("li[data-slot]");
    if (!draggedId || !slotEl) return;
    handleEmptyDropOnSlot(Number(slotEl.dataset.slot));
    return;
  }
  e.preventDefault();
  if (!draggedId || !placeholderEl) return;
  const orderedIds = Array.from(listEl.querySelectorAll("li:not(.placeholder):not(.dragging)")).map(
    (li) => li.dataset.id,
  );
  const children = Array.from(listEl.children);
  const placeholderIndex = children.indexOf(placeholderEl);
  const idBeforeCount =
    placeholderIndex === -1
      ? orderedIds.length
      : children
          .slice(0, placeholderIndex)
          .filter((el) => !el.classList.contains("placeholder") && !el.classList.contains("dragging"))
          .length;
  orderedIds.splice(idBeforeCount, 0, draggedId);
  const itemById = new Map(items.map((item) => [item.id, item]));
  items = orderedIds.map((id) => itemById.get(id));
  render();
  clearDragState();
});

listEl.addEventListener("dragend", () => {
  if (initialState === "empty") {
    if (draggedEl) draggedEl.classList.remove("dragging");
    clearDragState();
    return;
  }
  if (!draggedEl || !placeholderEl) {
    clearDragState();
    return;
  }
  if (placeholderEl.parentNode) {
    listEl.insertBefore(draggedEl, placeholderEl);
    placeholderEl.remove();
  }
  draggedEl.style.display = "";
  draggedEl.classList.remove("dragging");
  clearDragState();
});

poolEl.addEventListener("dragstart", (e) => {
  if (initialState !== "empty") return;
  handleEmptyDragStart(e, "pool");
});

poolEl.addEventListener("dragover", (e) => {
  if (initialState !== "empty") return;
  e.preventDefault();
});

poolEl.addEventListener("drop", (e) => {
  if (initialState !== "empty") return;
  e.preventDefault();
  if (!draggedId) return;
  handleEmptyDropOnPool();
});

poolEl.addEventListener("dragend", () => {
  if (initialState !== "empty") return;
  if (draggedEl) draggedEl.classList.remove("dragging");
  clearDragState();
});

listEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-dir]");
  if (!btn) return;
  const index = Number(btn.dataset.index);
  const dir = btn.dataset.dir;
  moveItem(index, dir);
});

checkBtn.addEventListener("click", () => {
  updateResult();
  markCorrectness();
});

async function init() {
  if (!uniqueId) {
    setStatus("unique_id is verplicht. Gebruik ?unique_id=...&data=URL-naar-json", true);
    subtitleEl.textContent = "Context ontbreekt";
    checkBtn.style.display = "none";
    return;
  }
  if (!dataUrl) {
    setStatus("Geen data-URL opgegeven. Gebruik ?data=URL-naar-json", true);
    subtitleEl.textContent = "Data ontbreekt";
    checkBtn.style.display = "none";
    return;
  }
  try {
    const res = await fetch(dataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    subtitleEl.textContent = data.title || "Juiste volgorde";
    renderImage(data.image, data.imageAlt, data.imageCaption);
    initialState = data.initialState === "empty" ? "empty" : "re-order";
    itemsById = new Map(data.items.map((item) => [item.id, item]));
    correctOrder = data.items.map((item) => item.id);
    if (initialState === "empty") {
      slots = new Array(correctOrder.length).fill(null);
      const poolItems = data.shuffle ? shuffle(data.items) : data.items.slice();
      pool = poolItems.map((item) => item.id);
      items = [];
    } else {
      items = data.shuffle ? shuffle(data.items) : data.items.slice();
      slots = [];
      pool = [];
    }
    showCheck = data.showCheck !== false;
    showCorrectOnCheck = data.showCorrectOnCheck !== false;
    checkBtn.style.display = showCheck ? "inline-flex" : "none";
    render();
    const cardEl = document.querySelector(".card");
    completion = window.LearningToolsCompletion?.create?.({
      toolId: "juiste-volgorde",
      version: "v1",
      dataUrl: new URL(dataUrl, window.location.href).toString(),
      uniqueId,
      title: data.title || null,
      containerEl: cardEl,
      onReset: () => window.location.reload(),
    }) || null;
    setStatus(initialState === "empty" ? "Sleep opties naar de vakken." : "Sleep of gebruik ▲▼ om te sorteren.");
  } catch (err) {
    console.error(err);
    setStatus("Kan data niet laden. Controleer de data-URL.", true);
    subtitleEl.textContent = "Fout";
    checkBtn.style.display = "none";
  }
}

init();
