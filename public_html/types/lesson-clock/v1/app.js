const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data") || "example.json";

const els = {
  body: document.body,
  eyebrow: document.getElementById("eyebrow"),
  title: document.getElementById("title"),
  message: document.getElementById("message"),
  face: document.getElementById("face"),
  pie: document.getElementById("pie"),
  time: document.getElementById("time"),
  label: document.getElementById("label"),
  lessonName: document.getElementById("lessonName"),
  range: document.getElementById("range"),
  status: document.getElementById("status"),
};

let data;
let lastFlashSecond = null;

function text(value, fallback = "") { return typeof value === "string" ? value : fallback; }

function parseTime(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatClock(date) {
  return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function setText(el, value) { el.textContent = value; }

function progressColor(remainingRatio) {
  const start = [242, 169, 59];
  const end = [233, 67, 67];
  const danger = 1 - Math.max(0, Math.min(1, remainingRatio));
  const rgb = start.map((channel, index) => Math.round(channel + (end[index] - channel) * danger));
  return `rgb(${rgb.join(", ")})`;
}

function render(now) {
  const lessons = data.lessons;
  const current = lessons.find((lesson) => now >= lesson.start && now < lesson.end);
  const next = lessons.find((lesson) => now < lesson.start);

  els.body.classList.remove("is-critical", "is-finished");
  if (current) {
    const remaining = current.end.getTime() - now.getTime();
    const duration = current.end.getTime() - current.start.getTime();
    const elapsed = now.getTime() - current.start.getTime();
    const remainingRatio = Math.max(0, Math.min(1, remaining / duration));
    const critical = remaining <= data.warningSeconds * 1000;
    const flashSecond = Math.floor(remaining / 1000);

    els.face.style.setProperty("--progress-angle", `${remainingRatio * 360}deg`);
    els.face.style.setProperty("--progress-color", progressColor(remainingRatio));
    setText(els.eyebrow, "NU AAN DE BEURT");
    setText(els.title, text(current.title, "Deze les"));
    setText(els.message, critical ? "De laatste seconden tikken weg." : "Blijf scherp.");
    setText(els.time, formatDuration(remaining));
    setText(els.label, "resterend");
    setText(els.lessonName, text(current.title));
    setText(els.range, `${formatClock(current.start)} – ${formatClock(current.end)}`);
    els.face.setAttribute("aria-label", `${formatDuration(remaining)} resterend voor ${text(current.title, "deze les")}`);
    if (critical) els.body.classList.add("is-critical");
    if (critical && flashSecond % data.flashEverySeconds === 0 && flashSecond !== lastFlashSecond) {
      els.body.classList.add("is-flashing");
      window.setTimeout(() => els.body.classList.remove("is-flashing"), 520);
      lastFlashSecond = flashSecond;
    }
    return;
  }

  lastFlashSecond = null;
  if (next) {
    const untilNext = next.start.getTime() - now.getTime();
    els.face.style.setProperty("--progress-angle", "0deg");
    els.face.style.setProperty("--progress-color", "#f2a93b");
    setText(els.eyebrow, "VOLGENDE LES");
    setText(els.title, text(next.title, "De volgende les komt eraan"));
    setText(els.message, "Maak je klaar.");
    setText(els.time, formatDuration(untilNext));
    setText(els.label, "tot de start");
    setText(els.lessonName, text(next.title));
    setText(els.range, `start om ${formatClock(next.start)}`);
    els.face.setAttribute("aria-label", `${formatDuration(untilNext)} tot ${text(next.title, "de volgende les")}`);
    return;
  }

  els.body.classList.add("is-finished");
  els.face.style.setProperty("--progress-angle", "0deg");
  setText(els.eyebrow, "KLAAR");
  setText(els.title, text(data.finishedTitle, "Alle lessen zijn voorbij"));
  setText(els.message, text(data.finishedMessage, "De klok is gestopt."));
  setText(els.time, "00:00");
  setText(els.label, "afgelopen");
  setText(els.lessonName, "");
  setText(els.range, "");
  els.face.setAttribute("aria-label", "Alle lessen zijn afgelopen");
}

function validate(raw) {
  if (!raw || !Array.isArray(raw.lessons) || raw.lessons.length === 0) throw new Error("Voeg minstens één les toe.");
  const lessons = raw.lessons.map((lesson) => ({
    ...lesson,
    start: parseTime(lesson.start),
    end: parseTime(lesson.end),
  }));
  if (lessons.some((lesson) => !lesson.start || !lesson.end || lesson.end <= lesson.start)) {
    throw new Error("Elke les heeft een geldige start en eindtijd nodig.");
  }
  lessons.sort((a, b) => a.start - b.start);
  return {
    ...raw,
    title: text(raw.title, "De tijd loopt"),
    warningSeconds: Number.isFinite(raw.warningSeconds) ? Math.max(5, raw.warningSeconds) : 30,
    flashEverySeconds: Number.isFinite(raw.flashEverySeconds) ? Math.max(1, raw.flashEverySeconds) : 5,
    lessons,
  };
}

async function start() {
  try {
    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Data kon niet worden geladen (${response.status}).`);
    data = validate(await response.json());
    setText(els.title, data.title);
    render(new Date());
    window.setInterval(() => render(new Date()), 250);
  } catch (error) {
    els.body.classList.add("has-error");
    setText(els.eyebrow, "FOUT IN DE KLOK");
    setText(els.title, "De lesklok kan niet starten");
    setText(els.message, error.message);
    setText(els.time, "--:--");
    els.status.hidden = false;
    setText(els.status, "Controleer de lessen en de ISO-tijdstippen in de configuratie.");
  }
}

start();
