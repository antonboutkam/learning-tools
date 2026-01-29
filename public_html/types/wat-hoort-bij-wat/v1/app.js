const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data");

const boardEl = document.getElementById("pairs");
const leftColEl = document.getElementById("leftCol");
const rightColEl = document.getElementById("rightCol");
const canvasEl = document.getElementById("wires");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const subtitleEl = document.getElementById("subtitle");
const checkBtn = document.getElementById("check");

let pairs = [];
let showCheck = true;
let showCorrectOnCheck = true;
let shuffleOptions = true;

let completion = null;

let leftItems = [];
let rightItems = [];

const leftConnectorById = new Map();
const rightConnectorById = new Map();
const leftNodeById = new Map();
const rightNodeById = new Map();
const rightById = new Map();

const leftToRight = new Map(); // leftId -> rightId
const rightToLeft = new Map(); // rightId -> leftId

let active = null; // { side: 'left'|'right', id: string, start: {x,y}, cursor:{x,y} }
let hoverTarget = null;
let checked = false;
let lastCanvasSize = { w: 0, h: 0, dpr: 0 };

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

function boardPointFromClient(clientX, clientY) {
  const rect = boardEl.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function connectorCenter(connectorEl) {
  const crect = connectorEl.getBoundingClientRect();
  const brect = boardEl.getBoundingClientRect();
  return {
    x: crect.left - brect.left + crect.width / 2,
    y: crect.top - brect.top + crect.height / 2,
  };
}

function setConnectorState() {
  for (const [id, el] of leftConnectorById) {
    el.classList.toggle("connected", leftToRight.has(id));
    el.classList.toggle("active", active?.side === "left" && active?.id === id);
  }
  for (const [id, el] of rightConnectorById) {
    el.classList.toggle("connected", rightToLeft.has(id));
    el.classList.toggle("active", active?.side === "right" && active?.id === id);
  }
}

function resizeCanvasIfNeeded() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = boardEl.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (w === lastCanvasSize.w && h === lastCanvasSize.h && dpr === lastCanvasSize.dpr) return;
  lastCanvasSize = { w, h, dpr };
  canvasEl.width = Math.round(w * dpr);
  canvasEl.height = Math.round(h * dpr);
  const ctx = canvasEl.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawWire(ctx, from, to, { color, width = 3, alpha = 1 } = {}) {
  const dx = Math.max(40, Math.abs(to.x - from.x) * 0.35);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.bezierCurveTo(from.x + dx, from.y, to.x - dx, to.y, to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function computeScore() {
  let correctCount = 0;
  const perLeft = new Map();
  leftItems.forEach((li) => {
    const connectedRightId = leftToRight.get(li.id);
    if (!connectedRightId) {
      perLeft.set(li.id, "incorrect");
      return;
    }
    const connectedRight = rightById.get(connectedRightId);
    const ok = connectedRight?.text === li.correctRight;
    perLeft.set(li.id, ok ? "correct" : "incorrect");
    if (ok) correctCount += 1;
  });
  return { correctCount, total: leftItems.length, perLeft };
}

function applyCheckStyling(score) {
  leftNodeById.forEach((nodeEl, id) => {
    nodeEl.classList.remove("correct", "incorrect");
    if (!showCorrectOnCheck) return;
    nodeEl.classList.add(score.perLeft.get(id) === "correct" ? "correct" : "incorrect");
  });

  rightNodeById.forEach((nodeEl) => {
    nodeEl.classList.remove("correct", "incorrect");
  });
}

function redraw() {
  resizeCanvasIfNeeded();
  const ctx = canvasEl.getContext("2d");
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#9a5b2e";
  const good = getComputedStyle(document.documentElement).getPropertyValue("--good").trim() || "#2d8a3c";
  const bad = getComputedStyle(document.documentElement).getPropertyValue("--bad").trim() || "#b43c2b";

  const score = checked ? computeScore() : null;

  for (const [leftId, rightId] of leftToRight.entries()) {
    const leftConnector = leftConnectorById.get(leftId);
    const rightConnector = rightConnectorById.get(rightId);
    if (!leftConnector || !rightConnector) continue;
    const from = connectorCenter(leftConnector);
    const to = connectorCenter(rightConnector);
    let color = accent;
    if (checked && showCorrectOnCheck) {
      color = score?.perLeft?.get(leftId) === "correct" ? good : bad;
    }
    drawWire(ctx, from, to, { color, width: 3.5, alpha: 0.95 });
  }

  if (active) {
    const startConnector = active.side === "left" ? leftConnectorById.get(active.id) : rightConnectorById.get(active.id);
    if (startConnector) {
      const from = connectorCenter(startConnector);
      const to = active.cursor || from;
      drawWire(ctx, from, to, { color: accent, width: 3, alpha: 0.55 });
    }
  }
}

function disconnectLeft(leftId) {
  const rightId = leftToRight.get(leftId);
  if (rightId) rightToLeft.delete(rightId);
  leftToRight.delete(leftId);
}

function disconnectRight(rightId) {
  const leftId = rightToLeft.get(rightId);
  if (leftId) leftToRight.delete(leftId);
  rightToLeft.delete(rightId);
}

function connect(leftId, rightId) {
  disconnectLeft(leftId);
  disconnectRight(rightId);
  leftToRight.set(leftId, rightId);
  rightToLeft.set(rightId, leftId);
}

function cancelActive() {
  active = null;
  if (hoverTarget) {
    hoverTarget.classList.remove("hover-target");
    hoverTarget = null;
  }
  setConnectorState();
  redraw();
}

function startActive(side, id) {
  const connector = side === "left" ? leftConnectorById.get(id) : rightConnectorById.get(id);
  if (!connector) return;
  const start = connectorCenter(connector);
  active = { side, id, start, cursor: start };
  if (hoverTarget) {
    hoverTarget.classList.remove("hover-target");
    hoverTarget = null;
  }
  setConnectorState();
  redraw();
}

function finishActive(side, id) {
  if (!active) return;
  if (active.side === side && active.id === id) {
    cancelActive();
    return;
  }
  if (active.side === side) {
    if (side === "left" && leftToRight.has(id)) disconnectLeft(id);
    if (side === "right" && rightToLeft.has(id)) disconnectRight(id);
    startActive(side, id);
    return;
  }

  const leftId = active.side === "left" ? active.id : id;
  const rightId = active.side === "right" ? active.id : id;
  connect(leftId, rightId);
  active = null;
  if (hoverTarget) {
    hoverTarget.classList.remove("hover-target");
    hoverTarget = null;
  }
  setConnectorState();
  redraw();
}

function renderBoard() {
  leftColEl.innerHTML = "";
  rightColEl.innerHTML = "";
  leftConnectorById.clear();
  rightConnectorById.clear();
  leftNodeById.clear();
  rightNodeById.clear();
  rightById.clear();
  leftToRight.clear();
  rightToLeft.clear();
  active = null;
  checked = false;
  resultEl.textContent = "";

  leftItems.forEach((item) => {
    const node = document.createElement("div");
    node.className = "node";
    node.dataset.side = "left";
    node.dataset.id = item.id;
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = item.text;
    const connector = document.createElement("button");
    connector.type = "button";
    connector.className = "connector";
    connector.dataset.side = "left";
    connector.dataset.id = item.id;
    connector.setAttribute("aria-label", `Koppel: ${item.text}`);
    node.appendChild(label);
    node.appendChild(connector);
    leftColEl.appendChild(node);
    leftConnectorById.set(item.id, connector);
    leftNodeById.set(item.id, node);
  });

  rightItems.forEach((item) => {
    rightById.set(item.id, item);
    const node = document.createElement("div");
    node.className = "node";
    node.dataset.side = "right";
    node.dataset.id = item.id;
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = item.text;
    const connector = document.createElement("button");
    connector.type = "button";
    connector.className = "connector";
    connector.dataset.side = "right";
    connector.dataset.id = item.id;
    connector.setAttribute("aria-label", `Koppel: ${item.text}`);
    node.appendChild(label);
    node.appendChild(connector);
    rightColEl.appendChild(node);
    rightConnectorById.set(item.id, connector);
    rightNodeById.set(item.id, node);
  });

  setConnectorState();
  redraw();
}

function updateResultAndMaybeComplete() {
  const score = computeScore();
  resultEl.textContent = `${score.correctCount} van ${score.total} goed`;
  applyCheckStyling(score);
  if (score.correctCount === score.total) {
    completion?.markCompleted({ score: { correct: score.total, total: score.total } });
  }
  redraw();
}

boardEl.addEventListener("click", (e) => {
  const connector = e.target.closest(".connector");
  if (!connector) return;
  const side = connector.dataset.side;
  const id = connector.dataset.id;
  if (!side || !id) return;

  checked = false;
  leftNodeById.forEach((node) => node.classList.remove("correct", "incorrect"));
  rightNodeById.forEach((node) => node.classList.remove("correct", "incorrect"));

  if (!active) {
    if (side === "left" && leftToRight.has(id)) disconnectLeft(id);
    if (side === "right" && rightToLeft.has(id)) disconnectRight(id);
    startActive(side, id);
    return;
  }

  finishActive(side, id);
});

window.addEventListener("pointermove", (e) => {
  if (!active) return;
  active.cursor = boardPointFromClient(e.clientX, e.clientY);
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const connector = el?.closest?.(".connector") || null;
  const isOppositeSide = connector && connector.dataset?.side && connector.dataset.side !== active.side;
  const nextTarget = isOppositeSide ? connector : null;
  if (hoverTarget !== nextTarget) {
    if (hoverTarget) hoverTarget.classList.remove("hover-target");
    hoverTarget = nextTarget;
    if (hoverTarget) hoverTarget.classList.add("hover-target");
  }
  redraw();
});

window.addEventListener("resize", redraw);
window.addEventListener("scroll", redraw, true);

if ("ResizeObserver" in window) {
  const ro = new ResizeObserver(() => redraw());
  ro.observe(boardEl);
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && active) cancelActive();
});

document.addEventListener(
  "click",
  (e) => {
    if (!active) return;
    if (e.target.closest(".connector")) return;
    cancelActive();
  },
  true
);

checkBtn.addEventListener("click", () => {
  checked = true;
  updateResultAndMaybeComplete();
});

async function init() {
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

    subtitleEl.textContent = data.title || "Wat hoort bij wat";
    pairs = data.pairs.slice();
    showCheck = data.showCheck !== false;
    showCorrectOnCheck = data.showCorrectOnCheck !== false;
    shuffleOptions = data.shuffleOptions !== false;
    checkBtn.style.display = showCheck ? "inline-flex" : "none";

    leftItems = pairs.map((p, idx) => ({ id: `L${idx}`, text: p.left, correctRight: p.right }));
    const rightTexts = pairs.map((p) => p.right);
    const shuffledRights = shuffleOptions ? shuffle(rightTexts) : rightTexts.slice();
    rightItems = shuffledRights.map((text, idx) => ({ id: `R${idx}`, text }));

    completion =
      window.LearningToolsCompletion?.create?.({
        toolId: "wat-hoort-bij-wat",
        version: "v1",
        dataUrl: new URL(dataUrl, window.location.href).toString(),
        title: data.title || null,
        containerEl: document.querySelector(".card"),
        onReset: () => window.location.reload(),
      }) || null;

    renderBoard();
    setStatus("Maak koppelingen door twee rondjes te verbinden. Druk op Esc om te annuleren.");
  } catch (err) {
    console.error(err);
    setStatus("Kan data niet laden. Controleer de data-URL.", true);
    subtitleEl.textContent = "Fout";
    checkBtn.style.display = "none";
  }
}

init();
