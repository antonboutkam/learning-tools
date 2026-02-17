const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data");
const queryUniqueId = params.get("unique_id");

const subtitleEl = document.getElementById("subtitle");
const challengeLabelEl = document.getElementById("challengeLabel");
const sourceNumberEl = document.getElementById("sourceNumber");
const positionRowEl = document.getElementById("positionRow");
const digitRowEl = document.getElementById("digitRow");
const displayScrollEl = document.getElementById("displayScroll");
const keyboardEl = document.getElementById("keyboard");
const backspaceBtn = document.getElementById("backspace");
const checkBtn = document.getElementById("check");
const resultEl = document.getElementById("result");
const statusEl = document.getElementById("status");
const previewPanelEl = document.getElementById("previewPanel");
const previewBinEl = document.getElementById("previewBin");
const previewDecEl = document.getElementById("previewDec");
const previewHexEl = document.getElementById("previewHex");
const previewNoteEl = document.getElementById("previewNote");
const cardEl = document.getElementById("card");

const BASES = new Set(["bin", "dec", "hex"]);
const BYTE_SIZES = [4, 8, 16, 32, 64, 128, 256];
const ALPHABET_BY_BASE = {
  bin: "01",
  dec: "0123456789",
  hex: "0123456789ABCDEF",
};
const KEY_LAYOUT_BY_BASE = {
  bin: ["0", "1"],
  dec: ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0"],
  hex: ["A", "B", "C", "D", "E", "F", "7", "8", "9", "4", "5", "6", "1", "2", "3", "0"],
};

const state = {
  ready: false,
  answer: "",
  slotCount: 0,
  sourceValue: 0n,
  maxValue: 0n,
  completion: null,
  uniqueId: null,
  defaultStatus: "",
  config: null,
};

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "status error" : "status";
}

function setResult(message, mode = "") {
  resultEl.textContent = message;
  resultEl.className = mode ? `result ${mode}` : "result";
}

function normalizeToken(raw) {
  return String(raw ?? "").trim().replace(/[\s_]/g, "");
}

function sanitizeForBase(raw, base) {
  let token = normalizeToken(raw);
  if (base === "hex") token = token.replace(/^0x/i, "");
  if (base === "bin") token = token.replace(/^0b/i, "");
  return token.toUpperCase();
}

function parseBaseValue(raw, base) {
  const token = sanitizeForBase(raw, base);
  if (!token) throw new Error("Lege invoer");

  const validators = {
    bin: /^[01]+$/,
    dec: /^[0-9]+$/,
    hex: /^[0-9A-F]+$/,
  };
  if (!validators[base].test(token)) {
    throw new Error(`Ongeldige ${base.toUpperCase()} invoer`);
  }

  if (base === "bin") return { token, value: BigInt(`0b${token}`) };
  if (base === "hex") return { token, value: BigInt(`0x${token}`) };
  return { token, value: BigInt(token) };
}

function formatValue(value, base, byteSize, padded = true) {
  if (base === "dec") return value.toString(10);
  if (base === "bin") {
    const raw = value.toString(2);
    return padded ? raw.padStart(byteSize, "0") : raw;
  }
  const raw = value.toString(16).toUpperCase();
  const width = Math.ceil(byteSize / 4);
  return padded ? raw.padStart(width, "0") : raw;
}

function decimalSlotCount(byteSize) {
  const maxValue = (1n << BigInt(byteSize)) - 1n;
  return maxValue.toString(10).length;
}

function computeSlotCount(output, byteSize) {
  if (output === "bin") return byteSize;
  if (output === "hex") return Math.ceil(byteSize / 4);
  return decimalSlotCount(byteSize);
}

function setPreviewValues(bin, dec, hex, note) {
  previewBinEl.textContent = bin;
  previewDecEl.textContent = dec;
  previewHexEl.textContent = hex;
  previewNoteEl.textContent = note || "";
}

function resetFeedback() {
  setResult("");
  setStatus(state.defaultStatus);
}

function scrollDisplayToRight() {
  displayScrollEl.scrollLeft = displayScrollEl.scrollWidth;
}

function renderPositionRow() {
  positionRowEl.innerHTML = "";
  for (let pos = state.slotCount - 1; pos >= 0; pos -= 1) {
    const cell = document.createElement("div");
    cell.className = "position-cell";
    cell.textContent = String(pos);
    positionRowEl.appendChild(cell);
  }
}

function renderDigitRow() {
  digitRowEl.innerHTML = "";
  const paddedAnswer = state.answer.padStart(state.slotCount, " ").slice(-state.slotCount);
  for (const char of paddedAnswer) {
    const cell = document.createElement("div");
    const isEmpty = char === " ";
    cell.className = isEmpty ? "digit-cell empty" : "digit-cell";
    cell.textContent = isEmpty ? " " : char;
    digitRowEl.appendChild(cell);
  }
  scrollDisplayToRight();
}

function updatePreview() {
  if (!state.config.preview) {
    previewPanelEl.hidden = true;
    return;
  }

  previewPanelEl.hidden = false;
  if (!state.answer) {
    setPreviewValues("-", "-", "-", "Typ een waarde om live conversie te zien.");
    return;
  }

  try {
    const parsed = parseBaseValue(state.answer, state.config.output).value;
    if (parsed > state.maxValue) {
      setPreviewValues("-", "-", "-", `Waarde valt buiten ${state.config.byteSize}-bit bereik.`);
      return;
    }

    setPreviewValues(
      formatValue(parsed, "bin", state.config.byteSize, true),
      parsed.toString(10),
      formatValue(parsed, "hex", state.config.byteSize, true),
      `Invoer gelezen als ${state.config.output.toUpperCase()}.`
    );
  } catch {
    setPreviewValues("-", "-", "-", "Ongeldige invoer.");
  }
}

function appendChar(char) {
  if (state.answer.length >= state.slotCount) {
    setStatus(`Maximaal ${state.slotCount} tekens mogelijk.`, true);
    return;
  }
  state.answer += char;
  resetFeedback();
  renderDigitRow();
  updatePreview();
}

function backspace() {
  if (!state.answer) return;
  state.answer = state.answer.slice(0, -1);
  resetFeedback();
  renderDigitRow();
  updatePreview();
}

function checkAnswer() {
  if (!state.answer) {
    setStatus("Voer eerst een antwoord in.", true);
    setResult("Nog geen invoer", "bad");
    return;
  }

  let parsed;
  try {
    parsed = parseBaseValue(state.answer, state.config.output).value;
  } catch {
    setStatus("Invoer bevat ongeldige tekens.", true);
    setResult("Niet correct", "bad");
    return;
  }

  if (parsed > state.maxValue) {
    setStatus(`Waarde valt buiten ${state.config.byteSize}-bit bereik.`, true);
    setResult("Niet correct", "bad");
    return;
  }

  if (state.config.output !== "dec" && state.answer.length !== state.slotCount) {
    setStatus(`Gebruik exact ${state.slotCount} posities voor ${state.config.output.toUpperCase()}.`, true);
    setResult("Niet correct", "bad");
    return;
  }

  if (parsed === state.sourceValue) {
    setStatus("Goed gedaan. Je omzetting klopt.");
    setResult("Correct", "ok");
    state.completion?.markCompleted({ score: { correct: 1, total: 1 } });
    return;
  }

  setStatus("Nog niet goed. Probeer opnieuw.", true);
  setResult("Niet correct", "bad");
}

function buildKeyboard() {
  keyboardEl.innerHTML = "";
  keyboardEl.dataset.kind = state.config.output;

  const layout = KEY_LAYOUT_BY_BASE[state.config.output] || [];
  for (const key of layout) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "key";
    btn.textContent = key;
    btn.setAttribute("aria-label", `Toets ${key}`);
    btn.addEventListener("click", () => appendChar(key));
    keyboardEl.appendChild(btn);
  }
}

function normalizeConfig(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Data moet een object zijn.");
  }

  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Bin/Hex/Dec Reken";

  const input = String(data.input ?? "").trim().toLowerCase();
  const output = String(data.output ?? "").trim().toLowerCase();
  if (!BASES.has(input)) throw new Error("input moet bin, dec of hex zijn.");
  if (!BASES.has(output)) throw new Error("output moet bin, dec of hex zijn.");

  const byteSizeRaw = Number.parseInt(String(data.byte_size ?? ""), 10);
  if (!BYTE_SIZES.includes(byteSizeRaw)) {
    throw new Error(`byte_size moet een van deze waarden zijn: ${BYTE_SIZES.join(", ")}.`);
  }

  const rawGetal = typeof data.getal === "number" ? String(data.getal) : String(data.getal ?? "").trim();
  if (!rawGetal) {
    throw new Error("getal ontbreekt.");
  }

  let value;
  try {
    value = parseBaseValue(rawGetal, input).value;
  } catch {
    throw new Error(`getal moet een geldige ${input.toUpperCase()} waarde zijn.`);
  }

  const maxValue = (1n << BigInt(byteSizeRaw)) - 1n;
  if (value > maxValue) {
    throw new Error(`getal past niet in ${byteSizeRaw} bits.`);
  }

  const configUniqueId = typeof data.unique_id === "string" ? data.unique_id.trim() : "";

  return {
    title,
    input,
    output,
    byteSize: byteSizeRaw,
    preview: data.preview === true,
    uniqueId: configUniqueId,
    sourceValue: value,
    maxValue,
  };
}

function applyConfig(config) {
  state.config = config;
  state.sourceValue = config.sourceValue;
  state.maxValue = config.maxValue;
  state.slotCount = computeSlotCount(config.output, config.byteSize);
  state.answer = "";

  subtitleEl.textContent = `${config.title} (${config.byteSize}-bit bereik)`;
  challengeLabelEl.textContent = `Zet dit ${config.input.toUpperCase()} getal om naar ${config.output.toUpperCase()}:`;
  sourceNumberEl.textContent = formatValue(config.sourceValue, config.input, config.byteSize, config.input !== "dec");

  renderPositionRow();
  renderDigitRow();
  buildKeyboard();

  state.defaultStatus =
    config.output === "dec"
      ? `Gebruik de toetsen. Posities lopen van ${state.slotCount - 1} (links) naar 0 (rechts).`
      : `Gebruik exact ${state.slotCount} posities. Posities lopen van ${state.slotCount - 1} (links) naar 0 (rechts).`;

  resetFeedback();
  updatePreview();
  scrollDisplayToRight();
}

function handleKeyDown(event) {
  if (!state.ready) return;

  if (event.key === "Backspace") {
    event.preventDefault();
    backspace();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    checkAnswer();
    return;
  }

  const key = event.key.toUpperCase();
  const alphabet = ALPHABET_BY_BASE[state.config.output];
  if (alphabet.includes(key)) {
    event.preventDefault();
    appendChar(key);
  }
}

async function init() {
  if (!dataUrl) {
    subtitleEl.textContent = "Data ontbreekt";
    setStatus("Gebruik ?data=URL-naar-json", true);
    return;
  }

  try {
    const res = await fetch(dataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const config = normalizeConfig(data);
    const uniqueId = queryUniqueId || config.uniqueId;
    if (!uniqueId) {
      throw new Error("unique_id ontbreekt. Zet hem in querystring of in data.");
    }

    state.uniqueId = uniqueId;
    applyConfig(config);

    state.completion =
      window.LearningToolsCompletion?.create?.({
        toolId: "bin-hex-dec-reken",
        version: "v1",
        dataUrl: new URL(dataUrl, window.location.href).toString(),
        uniqueId,
        title: config.title,
        containerEl: cardEl,
        onReset: () => window.location.reload(),
      }) || null;

    state.ready = true;
  } catch (error) {
    console.error(error);
    subtitleEl.textContent = "Configuratiefout";
    setStatus(error.message || "Kan data niet laden.", true);
    setResult("Tool niet gestart", "bad");
  }
}

backspaceBtn.addEventListener("click", backspace);
checkBtn.addEventListener("click", checkAnswer);
window.addEventListener("keydown", handleKeyDown);

init();
