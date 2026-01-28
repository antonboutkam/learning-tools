const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data");

const rollerEl = document.getElementById("roller");
const questionEl = document.getElementById("question");
const subtitleEl = document.getElementById("subtitle");
const statusEl = document.getElementById("status");
const timerEl = document.getElementById("timer");
const resultEl = document.getElementById("result");

const startBtn = document.getElementById("start");
const yesBtn = document.getElementById("yes");
const noBtn = document.getElementById("no");

let questions = [];
let activeQuestion = null;
let rollerInterval = null;
let timerInterval = null;
let rollerSeconds = 4;
let questionSeconds = 10;

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "status bad" : "status";
}

function pickRandomQuestion() {
  return questions[Math.floor(Math.random() * questions.length)];
}

function stopIntervals() {
  if (rollerInterval) clearInterval(rollerInterval);
  if (timerInterval) clearInterval(timerInterval);
  rollerInterval = null;
  timerInterval = null;
}

function resetUI() {
  resultEl.textContent = "";
  resultEl.className = "status";
  timerEl.textContent = "";
}

function startRoller() {
  resetUI();
  stopIntervals();
  startBtn.disabled = true;
  yesBtn.disabled = true;
  noBtn.disabled = true;
  const endAt = Date.now() + rollerSeconds * 1000;
  rollerInterval = setInterval(() => {
    const q = pickRandomQuestion();
    rollerEl.textContent = q.question;
    if (Date.now() >= endAt) {
      stopIntervals();
      activeQuestion = pickRandomQuestion();
      questionEl.textContent = activeQuestion.question;
      rollerEl.textContent = "Vraag geselecteerd";
      startTimer();
      yesBtn.disabled = false;
      noBtn.disabled = false;
    }
  }, 120);
}

function startTimer() {
  let remaining = questionSeconds;
  timerEl.textContent = `Tijd: ${remaining}s`;
  timerInterval = setInterval(() => {
    remaining -= 1;
    timerEl.textContent = `Tijd: ${remaining}s`;
    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      resultEl.textContent = "Tijd is op!";
      resultEl.className = "status bad";
      yesBtn.disabled = true;
      noBtn.disabled = true;
      startBtn.disabled = false;
    }
  }, 1000);
}

function answer(value) {
  if (!activeQuestion) return;
  stopIntervals();
  const correct = activeQuestion.answer === value;
  resultEl.textContent = correct ? "Goed!" : "Fout.";
  resultEl.className = correct ? "status good" : "status bad";
  startBtn.disabled = false;
  yesBtn.disabled = true;
  noBtn.disabled = true;
}

startBtn.addEventListener("click", startRoller);
yesBtn.addEventListener("click", () => answer(true));
noBtn.addEventListener("click", () => answer(false));

async function init() {
  if (!dataUrl) {
    setStatus("Geen data-URL opgegeven. Gebruik ?data=URL-naar-json", true);
    subtitleEl.textContent = "Data ontbreekt";
    startBtn.disabled = true;
    yesBtn.disabled = true;
    noBtn.disabled = true;
    return;
  }
  try {
    const res = await fetch(dataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    subtitleEl.textContent = data.title || "Pubquiz yes/no";
    questions = data.questions.slice();
    rollerSeconds = data.rollerSeconds ?? 4;
    questionSeconds = data.questionSeconds ?? 10;
    questionEl.textContent = "Klik op start";
    setStatus("Klaar om te starten.");
  } catch (err) {
    console.error(err);
    setStatus("Kan data niet laden. Controleer de data-URL.", true);
    subtitleEl.textContent = "Fout";
    startBtn.disabled = true;
    yesBtn.disabled = true;
    noBtn.disabled = true;
  }
}

init();
