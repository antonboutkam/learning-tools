(function () {
  "use strict";

  const title = document.getElementById("title");
  const status = document.getElementById("status");
  const viewer = document.getElementById("viewer");
  const stepNumber = document.getElementById("stepNumber");
  const imageContainer = document.getElementById("imageContainer");
  const imageStatus = document.getElementById("imageStatus");
  const description = document.getElementById("description");
  const previousButton = document.getElementById("previousButton");
  const nextButton = document.getElementById("nextButton");
  const codeContainer = document.getElementById("codeContainer");
  const codeLabel = document.getElementById("codeLabel");
  const codeContent = document.getElementById("codeContent");
  const syncStatus = document.getElementById("syncStatus");
  let sync = null;
  let steps = [];
  let currentIndex = 0;

  function showStep(index, publish = true) {
    if (index < 0 || index >= steps.length) return;
    currentIndex = index;
    const step = steps[index];
    stepNumber.textContent = `Stap ${index + 1} van ${steps.length}`;
    description.textContent = step.beschrijving;
    imageStatus.hidden = true;
    imageStatus.textContent = "";
    imageContainer.hidden = !step.afbeelding;
    imageContainer.replaceChildren();
    codeContainer.hidden = !step.code;
    codeContent.replaceChildren();
    if (step.code) {
      codeLabel.textContent = ["javascript", "js"].includes(step.code.taal.toLowerCase()) ? "JavaScript" : step.code.taal;
      StappenplanCode.render(codeContent, step.code);
    }
    if (step.afbeelding) {
      const image = document.createElement("img");
      image.alt = step.alt || `Afbeelding bij stap ${index + 1}`;
      image.addEventListener("error", () => {
        // Een laat laadresultaat van een vorige stap mag de huidige stap niet wijzigen.
        if (imageContainer.firstElementChild !== image) return;
        image.hidden = true;
        imageStatus.textContent = "De afbeelding kon niet worden geladen. Je kunt de uitleg lezen en verdergaan.";
        imageStatus.hidden = false;
      });
      imageContainer.replaceChildren(image);
      image.src = step.afbeelding;
    }
    previousButton.disabled = index === 0;
    nextButton.disabled = index === steps.length - 1;
    if (publish && sync) sync.publish(index);
  }

  function imageUrl(value, base) {
    const url = new URL(value, base);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Gebruik een http(s)-URL of relatief pad voor afbeeldingen.");
    }
    return url.href;
  }

  function applyColors(config) {
    const style = document.documentElement.style;
    const colors = [
      ["achtergrondkleur", "--background", "#18243d"],
      ["beschrijvingAchtergrondkleur", "--description-background", "#fff3b0"],
      ["beschrijvingTekstkleur", "--description-foreground", "#000000"]
    ];
    for (const [key, property, fallback] of colors) {
      const value = config[key] === undefined ? fallback : config[key];
      if (typeof value !== "string" || !/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value)) {
        throw new Error(`Gebruik een hexkleur zoals #18243d voor ${key}.`);
      }
      style.setProperty(property, value);
    }
    // Houd titel en stapnummer leesbaar bij zowel lichte als donkere achtergronden.
    let hex = style.getPropertyValue("--background").slice(1);
    if (hex.length === 3) hex = [...hex].map((digit) => digit + digit).join("");
    const [r, g, b] = hex.match(/../g).map((part) => {
      const channel = parseInt(part, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    style.setProperty("--foreground", luminance > 0.179 ? "#000000" : "#ffffff");
  }

  async function load() {
    try {
      const data = new URLSearchParams(window.location.search).get("data");
      if (!data) throw new Error("Geen data-URL meegegeven. Gebruik ?data=example.json voor de demo.");
      const dataUrl = new URL(data, window.location.href);
      const response = await fetch(dataUrl.href, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const config = await response.json();
      if (!config || !Array.isArray(config.stappen) || config.stappen.length === 0) {
        throw new Error("De configuratie moet minimaal één stap bevatten.");
      }
      steps = config.stappen.map((step, index) => {
        if (!step || (step.afbeelding !== undefined && (typeof step.afbeelding !== "string" || !step.afbeelding.trim())) ||
            typeof step.beschrijving !== "string" || !step.beschrijving.trim() ||
            (step.alt !== undefined && typeof step.alt !== "string")) {
          throw new Error(`Stap ${index + 1} bevat een ongeldige afbeelding, beschrijving of alt-tekst.`);
        }
        if (step.code !== undefined && (!step.code || typeof step.code !== "object" ||
            typeof step.code.bron !== "string" || !step.code.bron.trim() ||
            typeof step.code.taal !== "string" || !step.code.taal.trim() ||
            (step.code.nadruk !== undefined && (!Array.isArray(step.code.nadruk) ||
              step.code.nadruk.some(fragment => typeof fragment !== "string" || !fragment.length))))) {
          throw new Error(`Stap ${index + 1} bevat een ongeldig codeblok.`);
        }
        return { ...step, afbeelding: step.afbeelding ? imageUrl(step.afbeelding, response.url || dataUrl.href) : undefined };
      });
      if (config.synchronisatieGroep !== undefined &&
          (typeof config.synchronisatieGroep !== "string" || !config.synchronisatieGroep.trim())) {
        throw new Error("De synchronisatiegroep moet een niet-lege tekst zijn.");
      }
      applyColors(config);
      if (typeof config.titel === "string" && config.titel.trim()) {
        title.textContent = config.titel;
        title.hidden = false;
      }
      previousButton.addEventListener("click", () => showStep(currentIndex - 1));
      nextButton.addEventListener("click", () => showStep(currentIndex + 1));
      document.addEventListener("keydown", (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
            event.target.closest("input, textarea, select, [contenteditable]")) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          showStep(currentIndex + (event.key === "ArrowLeft" ? -1 : 1));
        }
      });
      status.hidden = true;
      viewer.hidden = false;
      showStep(0);
      if (config.synchronisatieGroep) {
        syncStatus.hidden = false;
        try {
          sync = StappenplanSync.connect(window.BroadcastChannel, config.synchronisatieGroep, steps.length,
            index => showStep(index, false), () => {
              syncStatus.textContent = "Gekoppelde stappenplannen moeten evenveel stappen bevatten.";
            });
          syncStatus.textContent = "Gekoppeld: stappenplannen in dezelfde groep volgen elkaar in deze browser.";
          window.addEventListener("pagehide", () => { sync.close(); sync = null; });
          window.addEventListener("pageshow", event => { if (event.persisted) window.location.reload(); });
        } catch {
          syncStatus.textContent = "Deze browser ondersteunt de koppeling niet. Je kunt de stappen zelf doorlopen.";
        }
      }
    } catch (error) {
      status.textContent = `Kon het stappenplan niet laden: ${error.message}`;
      status.className = "error";
    }
  }

  load();
})();
