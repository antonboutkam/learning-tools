const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data");

const listEl = document.getElementById("list");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const subtitleEl = document.getElementById("subtitle");
const checkBtn = document.getElementById("check");

let items = [];
let correctOrder = [];
let showCheck = true;
let showCorrectOnCheck = true;

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

function updateResult() {
  const isCorrect = items.every((item, idx) => item.id === correctOrder[idx]);
  resultEl.textContent = isCorrect ? "Alles staat goed!" : "Nog niet helemaal.";
}

function markCorrectness() {
  const liEls = Array.from(listEl.querySelectorAll("li"));
  liEls.forEach((li, idx) => {
    li.classList.remove("correct", "incorrect");
    if (!showCorrectOnCheck) return;
    if (items[idx].id === correctOrder[idx]) {
      li.classList.add("correct");
    } else {
      li.classList.add("incorrect");
    }
  });
}

function moveItem(index, dir) {
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
  draggedId = e.target?.dataset?.id || null;
});

listEl.addEventListener("dragover", (e) => {
  e.preventDefault();
});

listEl.addEventListener("drop", (e) => {
  e.preventDefault();
  const targetId = e.target.closest("li")?.dataset?.id;
  if (!draggedId || !targetId || draggedId === targetId) return;
  const draggedIndex = items.findIndex((i) => i.id === draggedId);
  const targetIndex = items.findIndex((i) => i.id === targetId);
  const copy = items.slice();
  const [moved] = copy.splice(draggedIndex, 1);
  copy.splice(targetIndex, 0, moved);
  items = copy;
  render();
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
    correctOrder = data.items.map((item) => item.id);
    items = data.shuffle ? shuffle(data.items) : data.items.slice();
    showCheck = data.showCheck !== false;
    showCorrectOnCheck = data.showCorrectOnCheck !== false;
    checkBtn.style.display = showCheck ? "inline-flex" : "none";
    render();
    setStatus("Sleep of gebruik ▲▼ om te sorteren.");
  } catch (err) {
    console.error(err);
    setStatus("Kan data niet laden. Controleer de data-URL.", true);
    subtitleEl.textContent = "Fout";
    checkBtn.style.display = "none";
  }
}

init();
