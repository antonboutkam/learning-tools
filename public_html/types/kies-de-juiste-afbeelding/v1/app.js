const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data");
const uniqueId = params.get("unique_id");

const toolTitleEl = document.getElementById("tool-title");
const subtitleEl = document.getElementById("subtitle");
const imageGridEl = document.getElementById("image-grid");
const questionEl = document.getElementById("question");
const descriptionEl = document.getElementById("description");
const checkBtn = document.getElementById("check");
const resultEl = document.getElementById("result");
const statusEl = document.getElementById("status");
const countdownEl = document.getElementById("countdown");
const countdownNumberEl = document.getElementById("countdown-number");

let config = null;
let imagesById = new Map();
let imageOrder = [];
let selectedIds = new Set();
let completion = null;
let isLocked = false;
let countdownTimer = null;

function setLocked(value) {
  isLocked = value;
  checkBtn.disabled = value;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "status error" : "status";
}

function setResult(message, mode = "") {
  resultEl.textContent = message;
  resultEl.className = mode ? `status ${mode}` : "status";
}

function toInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function shuffleIds(ids, previous = []) {
  const copy = ids.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  if (copy.length > 1 && previous.length === copy.length && copy.every((id, index) => id === previous[index])) {
    copy.push(copy.shift());
  }

  return copy;
}

function normalizeAction(value) {
  return value === "toon-juiste-antwoord" ? "toon-juiste-antwoord" : "opnieuw-proberen";
}

function normalizeData(rawData) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    throw new Error("Data moet een object zijn.");
  }

  const vraag = typeof rawData.vraag === "string" ? rawData.vraag.trim() : "";
  if (!vraag) {
    throw new Error("`vraag` is verplicht.");
  }

  if (!Array.isArray(rawData.afbeeldingen) || rawData.afbeeldingen.length < 2) {
    throw new Error("Voeg minimaal 2 afbeeldingen toe.");
  }

  const seenIds = new Set();
  const afbeeldingen = rawData.afbeeldingen.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Afbeelding ${index + 1} is geen object.`);
    }

    const url = typeof item.url === "string" ? item.url.trim() : "";
    if (!url) {
      throw new Error(`Afbeelding ${index + 1} mist een geldige URL.`);
    }

    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `afbeelding-${index + 1}`;
    if (seenIds.has(id)) {
      throw new Error(`Dubbele afbeelding-id gevonden: ${id}`);
    }
    seenIds.add(id);

    return {
      id,
      url,
      alt: typeof item.alt === "string" ? item.alt : "",
      bijschrift: typeof item.bijschrift === "string" ? item.bijschrift : "",
      juist: item.juist === true,
    };
  });

  if (!afbeeldingen.some((item) => item.juist)) {
    throw new Error("Markeer minimaal 1 afbeelding als juist.");
  }

  return {
    toolTitle:
      typeof rawData.toolTitle === "string" && rawData.toolTitle.trim()
        ? rawData.toolTitle.trim()
        : "Kies de juiste afbeelding",
    vraag,
    beschrijving: typeof rawData.beschrijving === "string" ? rawData.beschrijving : "",
    afbeeldingenPerRij: toInteger(rawData.afbeeldingenPerRij, 2, 1, 6),
    antwoordBijFout: normalizeAction(rawData.antwoordBijFout),
    pauzeSeconden: toInteger(rawData.pauzeSeconden, 5, 0, 30),
    afbeeldingen,
  };
}

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdownEl.hidden = true;
}

function renderImages({ reveal = false } = {}) {
  if (!config) return;

  imageGridEl.style.setProperty("--columns", String(config.afbeeldingenPerRij));
  imageGridEl.style.setProperty("--columns-small", String(Math.min(config.afbeeldingenPerRij, 2)));
  imageGridEl.innerHTML = "";

  imageOrder.forEach((id) => {
    const image = imagesById.get(id);
    if (!image) return;

    const isSelected = selectedIds.has(id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "image-option";
    button.dataset.id = id;
    button.disabled = isLocked;
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");

    if (isSelected) {
      button.classList.add("selected");
    }

    if (reveal) {
      if (image.juist) {
        button.classList.add("correct");
      } else if (isSelected) {
        button.classList.add("incorrect");
      }
    }

    const badge = document.createElement("span");
    badge.className = "image-option__badge";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = reveal && !image.juist && isSelected ? "!" : "✓";

    const img = document.createElement("img");
    img.src = image.url;
    img.alt = image.alt || image.bijschrift || "";
    img.loading = "lazy";
    img.decoding = "async";

    const caption = document.createElement("span");
    caption.className = "image-option__caption";
    caption.textContent = image.bijschrift;

    button.append(badge, img, caption);
    imageGridEl.appendChild(button);
  });
}

function selectionIsCorrect() {
  return config.afbeeldingen.every((image) => selectedIds.has(image.id) === image.juist);
}

function resetForRetry() {
  if (!config) return;
  clearCountdown();
  setLocked(false);
  selectedIds = new Set();
  setResult("");
  imageOrder = shuffleIds(
    config.afbeeldingen.map((image) => image.id),
    imageOrder,
  );
  renderImages();
  setStatus("Kies de afbeelding(en) die bij de vraag horen.");
}

function startRetryPause() {
  const seconds = config.pauzeSeconden;
  setLocked(true);
  renderImages();

  if (seconds <= 0) {
    resetForRetry();
    return;
  }

  let remaining = seconds;
  countdownNumberEl.textContent = String(remaining);
  countdownEl.hidden = false;

  countdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      resetForRetry();
      return;
    }
    countdownNumberEl.textContent = String(remaining);
  }, 1000);
}

function handleCheck() {
  if (!config || isLocked) return;

  if (selectionIsCorrect()) {
    setLocked(true);
    setResult("Goed!", "good");
    setStatus("Alle juiste afbeeldingen zijn geselecteerd.");
    renderImages({ reveal: true });
    completion?.markCompleted?.({
      score: { correct: config.afbeeldingen.length, total: config.afbeeldingen.length },
    });
    return;
  }

  if (config.antwoordBijFout === "toon-juiste-antwoord") {
    setLocked(true);
    setResult("Nog niet helemaal.", "bad");
    setStatus("De juiste afbeeldingen zijn gemarkeerd.");
    renderImages({ reveal: true });
    return;
  }

  setResult("Nog niet helemaal. Probeer opnieuw.", "bad");
  setStatus("");
  startRetryPause();
}

imageGridEl.addEventListener("click", (event) => {
  if (!config || isLocked) return;

  const button = event.target.closest(".image-option");
  if (!button) return;

  const id = button.dataset.id;
  if (!id) return;

  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }

  setResult("");
  renderImages();
});

checkBtn.addEventListener("click", handleCheck);

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

  try {
    const res = await fetch(dataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    config = normalizeData(await res.json());
    imagesById = new Map(config.afbeeldingen.map((image) => [image.id, image]));
    imageOrder = config.afbeeldingen.map((image) => image.id);

    toolTitleEl.textContent = config.toolTitle;
    subtitleEl.textContent = "Selecteer alle juiste afbeeldingen.";
    questionEl.textContent = config.vraag;

    if (config.beschrijving.trim()) {
      descriptionEl.textContent = config.beschrijving;
      descriptionEl.hidden = false;
    }

    renderImages();

    const cardEl = document.querySelector(".card");
    completion =
      window.LearningToolsCompletion?.create?.({
        toolId: "kies-de-juiste-afbeelding",
        version: "v1",
        dataUrl: new URL(dataUrl, window.location.href).toString(),
        uniqueId,
        title: config.vraag || config.toolTitle || null,
        containerEl: cardEl,
        onReset: () => window.location.reload(),
      }) || null;

    setStatus("Kies de afbeelding(en) die bij de vraag horen.");
  } catch (err) {
    console.error(err);
    subtitleEl.textContent = "Fout";
    setStatus(err instanceof Error ? err.message : "Kan data niet laden.", true);
    checkBtn.style.display = "none";
  }
}

window.addEventListener("beforeunload", clearCountdown);

init();
