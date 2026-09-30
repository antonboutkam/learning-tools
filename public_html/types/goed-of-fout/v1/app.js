const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data");
const uniqueId = params.get("unique_id");
const assetBaseUrl = (() => {
  const candidates = [params.get("parentOrigin")];
  try {
    const dataOrigin = new URL(dataUrl || "", window.location.href).origin;
    if (dataOrigin !== window.location.origin) candidates.push(dataOrigin);
  } catch (_) {}
  const ancestorOrigins = window.location && window.location.ancestorOrigins;
  if (ancestorOrigins && ancestorOrigins.length) candidates.push(ancestorOrigins[0]);
  candidates.push(document.referrer, window.location.origin);
  for (const candidate of candidates) {
    try {
      const url = new URL(String(candidate || "").trim());
      if (url.protocol === "http:" || url.protocol === "https:") return `${url.origin}/`;
    } catch (_) {}
  }
  return `${window.location.origin}/`;
})();

const elements = {
  title: document.getElementById("tool-title"),
  intro: document.getElementById("intro"),
  progress: document.getElementById("progress"),
  quiz: document.getElementById("quiz-card"),
  image: document.getElementById("situation-image"),
  questionNumber: document.getElementById("question-number"),
  question: document.getElementById("question"),
  goodButton: document.getElementById("good-button"),
  wrongButton: document.getElementById("wrong-button"),
  feedback: document.getElementById("feedback"),
  result: document.getElementById("result-card"),
  resultIcon: document.getElementById("result-icon"),
  resultTitle: document.getElementById("result-title"),
  score: document.getElementById("score"),
  scoreDetail: document.getElementById("score-detail"),
  restartButton: document.getElementById("restart-button"),
  error: document.getElementById("error-card"),
  errorMessage: document.getElementById("error-message"),
};

let config;
let questionOrder = [];
let currentIndex = 0;
let correctAnswers = 0;
let locked = false;
let nextTimer;
let completion;

function toAbsoluteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("//")) {
    try {
      return `${new URL(assetBaseUrl).protocol}${raw}`;
    } catch {
      return `${window.location.protocol}${raw}`;
    }
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw;
  try {
    return new URL(raw, assetBaseUrl).href;
  } catch {
    return raw;
  }
}

function integerInRange(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeData(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("De configuratie moet een object zijn.");
  }
  if (!Array.isArray(raw.situaties) || raw.situaties.length < 1) {
    throw new Error("Voeg minimaal één situatie toe.");
  }

  const situaties = raw.situaties.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Situatie ${index + 1} is geen geldig object.`);
    }
    const afbeelding = typeof item.afbeelding === "string" ? toAbsoluteUrl(item.afbeelding) : "";
    if (!afbeelding) throw new Error(`Situatie ${index + 1} mist een afbeelding.`);
    if (typeof item.goed !== "boolean") throw new Error(`Situatie ${index + 1} mist het juiste antwoord.`);

    return {
      afbeelding,
      alt: typeof item.alt === "string" ? item.alt.trim() : "",
      vraag: typeof item.vraag === "string" ? item.vraag.trim() : "",
      goed: item.goed,
    };
  });

  const aantalVragen = integerInRange(raw.aantalVragen, situaties.length, 1, situaties.length);
  return {
    titel: typeof raw.titel === "string" && raw.titel.trim() ? raw.titel.trim() : "Goed of fout",
    introductie: typeof raw.introductie === "string" ? raw.introductie.trim() : "",
    vragenRandomiseren: raw.vragenRandomiseren === true,
    aantalVragen,
    minimaalGoed: integerInRange(raw.minimaalGoed, aantalVragen, 0, aantalVragen),
    situaties,
  };
}

function shuffled(items) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function setButtonsDisabled(disabled) {
  elements.goodButton.disabled = disabled;
  elements.wrongButton.disabled = disabled;
}

function showError(message) {
  clearTimeout(nextTimer);
  elements.quiz.hidden = true;
  elements.result.hidden = true;
  elements.progress.hidden = true;
  elements.error.hidden = false;
  elements.errorMessage.textContent = message;
}

function prepareQuiz() {
  clearTimeout(nextTimer);
  const source = config.vragenRandomiseren ? shuffled(config.situaties) : config.situaties.slice();
  questionOrder = source.slice(0, config.aantalVragen);
  currentIndex = 0;
  correctAnswers = 0;
  locked = false;
  elements.result.hidden = true;
  elements.error.hidden = true;
  elements.quiz.hidden = false;
  elements.progress.hidden = false;
  renderQuestion();
}

function renderQuestion() {
  const situation = questionOrder[currentIndex];
  elements.progress.textContent = `${currentIndex + 1} / ${questionOrder.length}`;
  elements.questionNumber.textContent = `Situatie ${currentIndex + 1} van ${questionOrder.length}`;
  elements.question.textContent = situation.vraag || "Is deze situatie goed of fout?";
  elements.image.src = situation.afbeelding;
  elements.image.alt = situation.alt;
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback";
  locked = false;
  setButtonsDisabled(false);
}

function finishQuiz() {
  const percentage = Math.round((correctAnswers / questionOrder.length) * 100);
  const perfect = correctAnswers === questionOrder.length;
  const passed = correctAnswers >= config.minimaalGoed;

  elements.quiz.hidden = true;
  elements.progress.hidden = true;
  elements.result.hidden = false;
  elements.result.className = passed ? "result-card result-card--passed" : "result-card result-card--failed";
  elements.score.textContent = `${percentage}%`;
  elements.scoreDetail.textContent = `${correctAnswers} van de ${questionOrder.length} antwoorden goed`;

  if (perfect) {
    elements.resultIcon.textContent = "🏆";
    elements.resultTitle.textContent = "Je hebt het perfect gedaan";
  } else if (passed) {
    elements.resultIcon.textContent = "🎉";
    elements.resultTitle.textContent = "Goedzo! Je begrijpt het goed genoeg";
  } else {
    elements.resultIcon.textContent = "😔";
    elements.resultTitle.textContent = "Jammer, je hebt nog een onvoldoende";
  }

  if (passed) {
    completion?.markCompleted?.({ score: { correct: correctAnswers, total: questionOrder.length } });
  }
  elements.restartButton.focus();
}

function answer(value) {
  if (locked) return;
  locked = true;
  setButtonsDisabled(true);
  const isCorrect = questionOrder[currentIndex].goed === value;
  if (isCorrect) correctAnswers += 1;
  elements.feedback.textContent = isCorrect ? "Goed beantwoord!" : "Helaas, dat antwoord is niet goed.";
  elements.feedback.className = isCorrect ? "feedback good" : "feedback wrong";

  nextTimer = setTimeout(() => {
    currentIndex += 1;
    if (currentIndex >= questionOrder.length) finishQuiz();
    else renderQuestion();
  }, 650);
}

elements.goodButton.addEventListener("click", () => answer(true));
elements.wrongButton.addEventListener("click", () => answer(false));
elements.restartButton.addEventListener("click", () => {
  if (completion?.isCompleted) completion.reset();
  else prepareQuiz();
});

async function init() {
  if (!uniqueId) {
    showError("unique_id is verplicht. Gebruik ?unique_id=...&data=URL-naar-json");
    return;
  }
  if (!dataUrl) {
    showError("Geen data-URL opgegeven. Gebruik ?data=URL-naar-json");
    return;
  }

  try {
    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Data laden mislukt (${response.status}).`);
    config = normalizeData(await response.json());
    elements.title.textContent = config.titel;
    elements.intro.textContent = config.introductie;
    elements.intro.hidden = !config.introductie;
    completion = window.LearningToolsCompletion?.create?.({
      uniqueId,
      toolId: "goed-of-fout",
      version: "v1",
      dataUrl,
      title: config.titel,
      containerEl: document.querySelector(".shell"),
      onReset: prepareQuiz,
    });
    prepareQuiz();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Onbekende fout bij het laden.");
  }
}

init();
