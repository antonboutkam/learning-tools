const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data");

const pairsEl = document.getElementById("pairs");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const subtitleEl = document.getElementById("subtitle");
const checkBtn = document.getElementById("check");

let pairs = [];
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

function render(options) {
  pairsEl.innerHTML = "";
  pairs.forEach((pair, idx) => {
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.index = String(idx);
    const select = document.createElement("select");
    select.innerHTML = options
      .map((opt) => `<option value="${opt}">${opt}</option>`)
      .join("");
    row.innerHTML = `<div>${pair.left}</div>`;
    row.appendChild(select);
    pairsEl.appendChild(row);
  });
}

function updateResult() {
  const rows = Array.from(pairsEl.querySelectorAll(".row"));
  let correctCount = 0;
  rows.forEach((row, idx) => {
    row.classList.remove("correct", "incorrect");
    const select = row.querySelector("select");
    const ok = select.value === pairs[idx].right;
    if (ok) correctCount += 1;
    if (!showCorrectOnCheck) return;
    row.classList.add(ok ? "correct" : "incorrect");
  });
  resultEl.textContent = `${correctCount} van ${pairs.length} goed`;
}

checkBtn.addEventListener("click", updateResult);

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
    checkBtn.style.display = showCheck ? "inline-flex" : "none";
    const options = data.shuffleOptions ? shuffle(pairs.map((p) => p.right)) : pairs.map((p) => p.right);
    render(options);
    setStatus("Kies het juiste antwoord bij elke term.");
  } catch (err) {
    console.error(err);
    setStatus("Kan data niet laden. Controleer de data-URL.", true);
    subtitleEl.textContent = "Fout";
    checkBtn.style.display = "none";
  }
}

init();
