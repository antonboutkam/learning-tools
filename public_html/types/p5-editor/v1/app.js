(() => {
  "use strict";

  const MAX_CODE_LENGTH = 100000;
  const AUTORUN_DELAY_MS = 700;
  const RUNNER_TIMEOUT_MS = 6000;
  const params = new URLSearchParams(window.location.search);
  const dataUrl = params.get("data");
  let uniqueId = params.get("unique_id")?.trim() || "";

  const titleEl = document.getElementById("title");
  const subtitleEl = document.getElementById("subtitle");
  const introEl = document.getElementById("intro");
  const editorEl = document.getElementById("editor");
  const previewEl = document.getElementById("preview");
  const statusEl = document.getElementById("status");
  const countEl = document.getElementById("count");
  const copyBtn = document.getElementById("copyBtn");
  const resetBtn = document.getElementById("resetBtn");
  const stopBtn = document.getElementById("stopBtn");
  const runBtn = document.getElementById("runBtn");

  let initialCode = "";
  let p5SourcePromise = null;
  let activeFrame = null;
  let activeUrl = "";
  let activeToken = "";
  let runnerTimer = null;
  let autorunTimer = null;
  let generation = 0;
  let autoRun = true;

  function setStatus(message, kind = "") {
    statusEl.textContent = message || "";
    statusEl.className = `status${kind ? ` ${kind}` : ""}`;
  }

  function storageKey() {
    return uniqueId ? `learning-tools:p5-editor:v1:${uniqueId}` : null;
  }

  function loadSavedCode() {
    const key = storageKey();
    if (!key) return null;
    try {
      const value = localStorage.getItem(key);
      return typeof value === "string" ? value : null;
    } catch {
      return null;
    }
  }

  function saveCode() {
    const key = storageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, editorEl.value);
    } catch {
      // De editor blijft werken wanneer opslag door de browser is geblokkeerd.
    }
  }

  function updateCount() {
    const code = editorEl.value;
    const lines = code ? code.split(/\r\n?|\n/).length : 0;
    countEl.textContent = `${lines} regels · ${code.length}/${MAX_CODE_LENGTH} tekens`;
  }

  function resetCode() {
    const key = storageKey();
    if (key) {
      try { localStorage.removeItem(key); } catch { /* Ignore. */ }
    }
    editorEl.value = initialCode;
    updateCount();
    setStatus("De demo-JavaScript is teruggezet.");
    runCode();
  }

  function randomToken() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function escapeScriptEnd(source) {
    return source.replace(/<\/script/gi, "<\\/script");
  }

  async function loadP5Source() {
    if (!p5SourcePromise) {
      p5SourcePromise = fetch("./p5.min.js", { cache: "force-cache" }).then(async (response) => {
        if (!response.ok) throw new Error(`p5.js kon niet worden geladen (HTTP ${response.status}).`);
        const source = await response.text();
        if (!source.includes("var p5=")) throw new Error("De lokale p5.js-bundel is ongeldig.");
        return source;
      }).catch((error) => {
        p5SourcePromise = null;
        throw error;
      });
    }
    return p5SourcePromise;
  }

  function runnerHtml(p5Source, userCode, token) {
    const safeP5 = escapeScriptEnd(p5Source);
    const safeUserCode = escapeScriptEnd(userCode);
    const safeToken = JSON.stringify(token);
    return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'">
  <style>
    html,body{margin:0;min-height:100%;background:#fff;color:#18202a;font-family:system-ui,sans-serif}
    body{display:grid;place-items:center;overflow:auto}
    main{display:grid;min-width:100%;min-height:100%;place-items:center}
    canvas{display:block;max-width:100%;height:auto!important}
  </style>
</head>
<body>
  <main id="sketch" aria-label="Uitvoer van de p5.js-sketch"></main>
  <script>
    (()=>{
      const token=${safeToken};
      const send=(type,detail={})=>parent.postMessage({type,token,...detail},"*");
      let failed=false;
      addEventListener("error",event=>{
        failed=true;
        const message=String(event.message||event.error?.message||"Onbekende JavaScript-fout").slice(0,1000);
        send("p5-runner:error",{message,line:Number(event.lineno)||0,column:Number(event.colno)||0});
      });
      addEventListener("unhandledrejection",event=>{
        failed=true;
        const message=String(event.reason?.message||event.reason||"Onbehandelde promise-fout").slice(0,1000);
        send("p5-runner:error",{message,line:0,column:0});
      });
      document.addEventListener("submit",event=>event.preventDefault(),true);
      document.addEventListener("click",event=>{if(event.target.closest?.("a"))event.preventDefault()},true);
      addEventListener("load",()=>{if(!failed)send("p5-runner:ready")});
    })();
  <\/script>
  <script>${safeP5}<\/script>
  <script>${safeUserCode}\n//# sourceURL=student-sketch.js<\/script>
</body>
</html>`;
  }

  function clearRunnerTimer() {
    if (runnerTimer !== null) window.clearTimeout(runnerTimer);
    runnerTimer = null;
  }

  function stopPreview(showMessage = true) {
    generation += 1;
    clearRunnerTimer();
    activeToken = "";
    if (activeFrame) activeFrame.remove();
    activeFrame = null;
    if (activeUrl) URL.revokeObjectURL(activeUrl);
    activeUrl = "";
    stopBtn.disabled = true;
    previewEl.innerHTML = '<div class="preview-placeholder">De preview is gestopt. Kies Uitvoeren om opnieuw te starten.</div>';
    if (showMessage) setStatus("Preview gestopt.");
  }

  async function runCode() {
    const code = editorEl.value;
    if (code.length > MAX_CODE_LENGTH) {
      setStatus(`De code is langer dan ${MAX_CODE_LENGTH} tekens.`, "error");
      return;
    }

    const thisGeneration = generation + 1;
    stopPreview(false);
    generation = thisGeneration;
    setStatus("Veilige preview voorbereiden…");
    runBtn.disabled = true;

    try {
      const p5Source = await loadP5Source();
      if (generation !== thisGeneration) return;
      const token = randomToken();
      const html = runnerHtml(p5Source, code, token);
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const frame = document.createElement("iframe");
      frame.title = "Uitvoer van de p5.js-sketch";
      frame.setAttribute("sandbox", "allow-scripts");
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.src = url;
      activeToken = token;
      activeUrl = url;
      activeFrame = frame;
      previewEl.replaceChildren(frame);
      stopBtn.disabled = false;
      runnerTimer = window.setTimeout(() => {
        if (activeFrame === frame) setStatus("De preview reageert niet. Gebruik Stop en controleer de sketch op een oneindige lus.", "error");
      }, RUNNER_TIMEOUT_MS);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "De preview kon niet worden gestart.", "error");
      stopPreview(false);
    } finally {
      runBtn.disabled = false;
    }
  }

  function scheduleAutorun() {
    if (!autoRun) return;
    if (autorunTimer !== null) window.clearTimeout(autorunTimer);
    autorunTimer = window.setTimeout(() => {
      autorunTimer = null;
      runCode();
    }, AUTORUN_DELAY_MS);
  }

  function setupInteractions() {
    editorEl.maxLength = MAX_CODE_LENGTH;
    editorEl.addEventListener("input", () => {
      updateCount();
      saveCode();
      scheduleAutorun();
    });
    editorEl.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        editorEl.setRangeText("  ", editorEl.selectionStart, editorEl.selectionEnd, "end");
        editorEl.dispatchEvent(new Event("input"));
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        runCode();
      }
    });
    runBtn.addEventListener("click", runCode);
    stopBtn.addEventListener("click", () => stopPreview(true));
    resetBtn.addEventListener("click", resetCode);
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(editorEl.value);
        setStatus("JavaScript gekopieerd.", "success");
      } catch {
        setStatus("Kopiëren lukt niet in deze browser of iframe.", "error");
      }
    });
    window.addEventListener("message", (event) => {
      if (!activeFrame || event.source !== activeFrame.contentWindow) return;
      if (event.origin !== "null") return;
      const data = event.data;
      if (!data || typeof data !== "object" || data.token !== activeToken) return;
      if (data.type === "p5-runner:ready") {
        clearRunnerTimer();
        setStatus("Sketch draait in de sandbox.", "success");
      } else if (data.type === "p5-runner:error") {
        clearRunnerTimer();
        const message = typeof data.message === "string" ? data.message.slice(0, 1000) : "Onbekende JavaScript-fout";
        const location = Number.isInteger(data.line) && data.line > 0 ? ` (regel ${data.line}${data.column > 0 ? `:${data.column}` : ""})` : "";
        setStatus(`${message}${location}`, "error");
      }
    });
    window.addEventListener("pagehide", () => stopPreview(false));
  }

  async function init() {
    setupInteractions();
    previewEl.innerHTML = '<div class="preview-placeholder">Preview wordt geladen…</div>';
    if (!dataUrl) {
      subtitleEl.textContent = "Data ontbreekt";
      setStatus("Geen data-URL opgegeven. Gebruik ?data=URL-naar-json.", "error");
      runBtn.disabled = true;
      return;
    }

    try {
      const response = await fetch(dataUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("De configuratie moet een JSON-object zijn.");
      if (typeof data.demoJavaScript !== "string") throw new Error("demoJavaScript ontbreekt in de configuratie.");
      if (data.demoJavaScript.length > MAX_CODE_LENGTH) throw new Error(`demoJavaScript mag maximaal ${MAX_CODE_LENGTH} tekens bevatten.`);
      if (!uniqueId && typeof data.unique_id === "string") uniqueId = data.unique_id.trim();

      titleEl.textContent = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "p5.js editor";
      subtitleEl.textContent = uniqueId ? `ID: ${uniqueId}` : "Schrijf JavaScript en bekijk direct het resultaat.";
      if (typeof data.intro === "string" && data.intro.trim()) {
        introEl.textContent = data.intro;
        introEl.hidden = false;
      }

      initialCode = data.demoJavaScript;
      autoRun = data.autoRun !== false;
      const saved = loadSavedCode();
      editorEl.value = saved === null ? initialCode : saved;
      editorEl.readOnly = data.readOnly === true;
      resetBtn.hidden = !uniqueId || data.readOnly === true;
      updateCount();
      if (saved !== null) setStatus("Lokaal opgeslagen JavaScript hersteld.");
      if (autoRun) {
        await runCode();
      } else {
        previewEl.innerHTML = '<div class="preview-placeholder">Kies Uitvoeren om de demo te starten.</div>';
        setStatus(saved === null ? "De demo is klaar om uit te voeren." : "Lokaal opgeslagen JavaScript hersteld.");
      }
    } catch (error) {
      console.error(error);
      subtitleEl.textContent = "Configuratiefout";
      setStatus(`Kan de configuratie niet laden: ${error.message}`, "error");
      previewEl.innerHTML = '<div class="preview-placeholder">Geen preview beschikbaar.</div>';
      runBtn.disabled = true;
    }
  }

  init();
})();
