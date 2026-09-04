(function () {
  "use strict";

  const FONT_FAMILIES = {
    modern: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    klassiek: 'Georgia, "Times New Roman", serif',
    monospace: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    speels: '"Trebuchet MS", "Arial Rounded MT Bold", sans-serif'
  };
  const EFFECTS_IN = new Set(["geen", "vervagen", "omhoog", "inzoomen"]);
  const EFFECTS_OUT = new Set(["geen", "vervagen", "omlaag", "uitzoomen"]);
  const params = new URLSearchParams(window.location.search);
  const dataUrl = params.get("data") || "";

  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const progressEl = document.getElementById("progress");
  const previousButton = document.getElementById("previousButton");
  const playButton = document.getElementById("playButton");
  const nextButton = document.getElementById("nextButton");

  let config = null;
  let currentIndex = 0;
  let playing = false;
  let ended = false;
  let slideTimer = null;
  let textTimers = [];

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, Number(value)));
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeText(item) {
    const begintijd = Math.max(0, finiteNumber(item.begintijd, 0));
    const eindtijd = Math.max(begintijd, finiteNumber(item.eindtijd, begintijd));
    const positie = item && typeof item.positie === "object" ? item.positie : {};
    return {
      tekst: String(item.tekst || ""),
      grootte: clamp(finiteNumber(item.grootte, 48), 12, 112),
      positie: {
        x: clamp(finiteNumber(positie.x, 50), 0, 100),
        y: clamp(finiteNumber(positie.y, 50), 0, 100)
      },
      kleur: /^#[0-9a-f]{6}$/i.test(String(item.kleur || "")) ? item.kleur : "#ffffff",
      lettertype: Object.prototype.hasOwnProperty.call(FONT_FAMILIES, item.lettertype) ? item.lettertype : "modern",
      begintijd,
      eindtijd,
      effectIn: EFFECTS_IN.has(item.effectIn) ? item.effectIn : "geen",
      effectOut: EFFECTS_OUT.has(item.effectOut) ? item.effectOut : "geen"
    };
  }

  function normalizeConfig(data) {
    const slides = Array.isArray(data.slides) ? data.slides : [];
    return {
      interval: Math.max(0.5, finiteNumber(data.interval, 5)),
      loop: data.loop === true,
      automatischStarten: data.automatischStarten === true,
      voortgang: ["bullets", "nummers", "geen"].includes(data.voortgang) ? data.voortgang : "bullets",
      slides: slides.map((slide) => ({
        duur: slide.duur === undefined ? null : Math.max(0.5, finiteNumber(slide.duur, 5)),
        teksten: Array.isArray(slide.teksten) ? slide.teksten.map(normalizeText) : []
      }))
    };
  }

  function setStatus(message, isError) {
    statusEl.textContent = message || "";
    statusEl.className = isError ? "status status--error" : "status";
  }

  function clearTimers() {
    window.clearTimeout(slideTimer);
    slideTimer = null;
    textTimers.forEach((timer) => window.clearTimeout(timer));
    textTimers = [];
  }

  function schedule(callback, delaySeconds) {
    const timer = window.setTimeout(callback, Math.max(0, delaySeconds * 1000));
    textTimers.push(timer);
  }

  function showText(element, text) {
    element.classList.add("is-visible");
    if (text.effectIn !== "geen") {
      element.classList.add(`effect-in--${text.effectIn}`);
    }
  }

  function hideText(element, text) {
    element.classList.remove(`effect-in--${text.effectIn}`);
    if (text.effectOut === "geen") {
      element.classList.remove("is-visible");
      return;
    }
    element.classList.add(`effect-out--${text.effectOut}`);
  }

  function renderProgress() {
    progressEl.replaceChildren();
    progressEl.hidden = config.voortgang === "geen";
    if (config.voortgang === "geen") {
      return;
    }

    if (config.voortgang === "nummers") {
      progressEl.textContent = `${currentIndex + 1} / ${config.slides.length}`;
      return;
    }

    config.slides.forEach((_, index) => {
      const bullet = document.createElement("button");
      bullet.className = "progress__bullet";
      bullet.type = "button";
      bullet.setAttribute("aria-label", `Ga naar slide ${index + 1}`);
      if (index === currentIndex) {
        bullet.setAttribute("aria-current", "step");
      }
      bullet.addEventListener("click", () => {
        ended = false;
        showSlide(index);
      });
      progressEl.appendChild(bullet);
    });
  }

  function updateControls() {
    const onFirst = currentIndex === 0;
    const onLast = currentIndex === config.slides.length - 1;
    previousButton.disabled = !config.loop && onFirst;
    nextButton.disabled = !config.loop && onLast;
    playButton.textContent = playing ? "Ⅱ" : "▶";
    playButton.setAttribute("aria-label", playing ? "Pauzeren" : ended ? "Opnieuw afspelen" : "Afspelen");
  }

  function renderText(text) {
    const element = document.createElement("p");
    element.className = "text-layer";
    element.textContent = text.tekst;
    element.style.setProperty("--x", `${text.positie.x}%`);
    element.style.setProperty("--y", `${text.positie.y}%`);
    element.style.setProperty("--color", text.kleur);
    element.style.setProperty("--font-size", `${text.grootte}px`);
    element.style.setProperty("--font-family", FONT_FAMILIES[text.lettertype]);
    stageEl.appendChild(element);

    if (text.begintijd === 0) {
      showText(element, text);
    } else if (playing) {
      schedule(() => showText(element, text), text.begintijd);
    }
    if (playing) {
      schedule(() => hideText(element, text), text.eindtijd);
    }
  }

  function slideDuration(slide) {
    return slide.duur === null ? config.interval : slide.duur;
  }

  function showSlide(index) {
    clearTimers();
    currentIndex = (index + config.slides.length) % config.slides.length;
    stageEl.replaceChildren();
    config.slides[currentIndex].teksten.forEach(renderText);
    renderProgress();
    updateControls();
    setStatus(playing ? "Wordt automatisch afgespeeld" : "Gepauzeerd");

    if (playing) {
      slideTimer = window.setTimeout(advanceAutomatically, slideDuration(config.slides[currentIndex]) * 1000);
    }
  }

  function advanceAutomatically() {
    if (currentIndex < config.slides.length - 1) {
      showSlide(currentIndex + 1);
      return;
    }
    if (config.loop) {
      showSlide(0);
      return;
    }
    playing = false;
    ended = true;
    clearTimers();
    updateControls();
    setStatus("Einde van de slide-show");
  }

  function goToRelativeSlide(offset) {
    const target = currentIndex + offset;
    if (target < 0) {
      if (config.loop) showSlide(config.slides.length - 1);
      return;
    }
    if (target >= config.slides.length) {
      if (config.loop) showSlide(0);
      return;
    }
    ended = false;
    showSlide(target);
  }

  function togglePlayback() {
    if (ended) {
      ended = false;
      playing = true;
      showSlide(0);
      return;
    }
    playing = !playing;
    showSlide(currentIndex);
  }

  function bindControls() {
    previousButton.addEventListener("click", () => goToRelativeSlide(-1));
    nextButton.addEventListener("click", () => goToRelativeSlide(1));
    playButton.addEventListener("click", togglePlayback);
    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") goToRelativeSlide(-1);
      if (event.key === "ArrowRight") goToRelativeSlide(1);
      if (event.key === " ") {
        event.preventDefault();
        togglePlayback();
      }
    });
  }

  async function load() {
    if (!dataUrl) {
      setStatus("Geen data-URL meegegeven. Gebruik ?data=example.json voor de demo.", true);
      return;
    }
    try {
      const response = await fetch(String(dataUrl), { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      config = normalizeConfig(await response.json());
      if (config.slides.length === 0) {
        throw new Error("De configuratie bevat geen slides.");
      }
      playing = config.automatischStarten;
      bindControls();
      showSlide(0);
    } catch (error) {
      setStatus(`Kon de slide-show niet laden: ${String(error.message || error)}`, true);
      stageEl.setAttribute("aria-label", "Slide-show kon niet worden geladen");
    }
  }

  load();
})();
