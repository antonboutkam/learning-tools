const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data");
const uniqueId = params.get("unique_id");

const rollerEl = document.getElementById("roller");
const questionEl = document.getElementById("question");
const subtitleEl = document.getElementById("subtitle");
const statusEl = document.getElementById("status");
const progressEl = document.getElementById("progress");
const timerEl = document.getElementById("timer");
const resultEl = document.getElementById("result");

const startBtn = document.getElementById("start");
const yesBtn = document.getElementById("yes");
const noBtn = document.getElementById("no");

let questions = [];
let quizOrder = [];
let activeQuestion = null;
let rollerInterval = null;
let timerInterval = null;
let rollerSeconds = 4;
let questionSeconds = 10;
let totalQuestionsToAsk = 1;
let minCorrectToPass = 1;
let currentQuestionIndex = 0;
let correctAnswers = 0;
let quizFinished = false;
let completion = null;

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "status bad" : "status";
}

function setProgress() {
  progressEl.textContent = `Voortgang: ${currentQuestionIndex}/${totalQuestionsToAsk} | Goed: ${correctAnswers}/${totalQuestionsToAsk} | Nodig voor certificaat: ${minCorrectToPass}`;
  progressEl.className = "status";
}

function pickRandomQuestion() {
  return questions[Math.floor(Math.random() * questions.length)];
}

function toPositiveInt(value, fallback, minimum = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const parsed = Math.floor(n);
  if (parsed < minimum) return minimum;
  return parsed;
}

function stopIntervals() {
  if (rollerInterval) clearInterval(rollerInterval);
  if (timerInterval) clearInterval(timerInterval);
  rollerInterval = null;
  timerInterval = null;
}

function resetRoundUI() {
  resultEl.textContent = "";
  resultEl.className = "status";
  timerEl.textContent = "";
}

function disableAnswerButtons() {
  yesBtn.disabled = true;
  noBtn.disabled = true;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function prepareQuiz() {
  const shuffled = questions.slice();
  shuffleInPlace(shuffled);
  quizOrder = shuffled.slice(0, totalQuestionsToAsk);
  currentQuestionIndex = 0;
  correctAnswers = 0;
  quizFinished = false;
  activeQuestion = null;
  stopIntervals();
  resetRoundUI();
  disableAnswerButtons();
  startBtn.disabled = false;
  startBtn.textContent = "Start roller";
  rollerEl.textContent = "Klik op start om te rollen";
  questionEl.textContent = "Klik op start";
  setProgress();
}

function startRoller() {
  if (quizFinished) {
    prepareQuiz();
  }
  if (!quizOrder.length || currentQuestionIndex >= quizOrder.length || activeQuestion) return;

  resetRoundUI();
  stopIntervals();
  startBtn.disabled = true;
  disableAnswerButtons();

  const endAt = Date.now() + rollerSeconds * 1000;
  const nextQuestion = quizOrder[currentQuestionIndex];

  rollerInterval = setInterval(() => {
    const randomQuestion = pickRandomQuestion();
    rollerEl.textContent = randomQuestion.question;
    if (Date.now() >= endAt) {
      stopIntervals();
      activeQuestion = nextQuestion;
      questionEl.textContent = activeQuestion.question;
      rollerEl.textContent = `Vraag ${currentQuestionIndex + 1} van ${totalQuestionsToAsk}`;
      startTimer();
      yesBtn.disabled = false;
      noBtn.disabled = false;
    }
  }, 120);
}

function finishQuiz() {
  quizFinished = true;
  activeQuestion = null;
  stopIntervals();
  disableAnswerButtons();

  const passed = correctAnswers >= minCorrectToPass;
  resultEl.textContent = passed
    ? `Eindscore: ${correctAnswers}/${totalQuestionsToAsk}. Certificaat behaald.`
    : `Eindscore: ${correctAnswers}/${totalQuestionsToAsk}. Certificaat niet behaald.`;
  resultEl.className = passed ? "status good" : "status bad";
  setStatus(
    passed
      ? "Je hebt de minimale score gehaald."
      : "Je hebt de minimale score niet gehaald."
  );

  if (passed) {
    completion?.markCompleted({
      score: { correct: correctAnswers, total: totalQuestionsToAsk },
    });
  }

  startBtn.disabled = false;
  startBtn.textContent = "Speel opnieuw";
  rollerEl.textContent = "Quiz afgerond";
  questionEl.textContent = "Klik op 'Speel opnieuw' om opnieuw te starten.";
}

function finishQuestion(isCorrect) {
  if (isCorrect) {
    correctAnswers += 1;
  }
  currentQuestionIndex += 1;
  setProgress();

  if (currentQuestionIndex >= totalQuestionsToAsk) {
    finishQuiz();
    return;
  }

  activeQuestion = null;
  disableAnswerButtons();
  startBtn.disabled = false;
  startBtn.textContent = "Volgende vraag";
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
      finishQuestion(false);
    }
  }, 1000);
}

function answer(value) {
  if (!activeQuestion || quizFinished) return;
  stopIntervals();
  const isCorrect = activeQuestion.answer === value;
  resultEl.textContent = isCorrect ? "Goed!" : "Fout.";
  resultEl.className = isCorrect ? "status good" : "status bad";
  finishQuestion(isCorrect);
}

startBtn.addEventListener("click", startRoller);
yesBtn.addEventListener("click", () => answer(true));
noBtn.addEventListener("click", () => answer(false));

async function init() {
  if (!uniqueId) {
    setStatus("unique_id is verplicht. Gebruik ?unique_id=...&data=URL-naar-json", true);
    subtitleEl.textContent = "Context ontbreekt";
    startBtn.disabled = true;
    disableAnswerButtons();
    return;
  }
  if (!dataUrl) {
    setStatus("Geen data-URL opgegeven. Gebruik ?data=URL-naar-json", true);
    subtitleEl.textContent = "Data ontbreekt";
    startBtn.disabled = true;
    disableAnswerButtons();
    return;
  }

  try {
    const res = await fetch(dataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data.questions) || data.questions.length < 2) {
      throw new Error("Voeg minimaal 2 vragen toe in data.questions.");
    }

    questions = data.questions.slice();
    rollerSeconds = toPositiveInt(data.rollerSeconds, 4, 1);
    questionSeconds = toPositiveInt(data.questionSeconds, 10, 3);

    let configNotice = "";
    totalQuestionsToAsk = toPositiveInt(data.questionsToAsk, 1, 1);
    if (totalQuestionsToAsk > questions.length) {
      totalQuestionsToAsk = questions.length;
      configNotice = ` Het aantal te stellen vragen was hoger dan het aantal beschikbare vragen en is aangepast naar ${questions.length}.`;
    }

    minCorrectToPass = toPositiveInt(data.minCorrectToPass, 1, 1);
    if (minCorrectToPass > totalQuestionsToAsk) {
      throw new Error("minCorrectToPass mag niet hoger zijn dan questionsToAsk.");
    }

    subtitleEl.textContent = data.title || "Pubquiz yes/no";

    const cardEl = document.querySelector(".card");
    completion = window.LearningToolsCompletion?.create?.({
      toolId: "pubquiz-yes-no",
      version: "v1",
      dataUrl: new URL(dataUrl, window.location.href).toString(),
      uniqueId,
      title: data.title || null,
      containerEl: cardEl,
      onReset: () => window.location.reload(),
    }) || null;

    prepareQuiz();
    setStatus(`Klaar om te starten: ${totalQuestionsToAsk} vragen, minimaal ${minCorrectToPass} goed voor certificaat.${configNotice}`);
  } catch (err) {
    console.error(err);
    setStatus("Kan data niet laden. Controleer de data-URL en instellingen.", true);
    subtitleEl.textContent = "Fout";
    startBtn.disabled = true;
    disableAnswerButtons();
  }
}

init();
