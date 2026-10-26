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
  let steps = [];
  let currentIndex = 0;

  function showStep(index) {
    if (index < 0 || index >= steps.length) return;
    currentIndex = index;
    const step = steps[index];
    stepNumber.textContent = `Stap ${index + 1} van ${steps.length}`;
    description.textContent = step.beschrijving;
    imageStatus.hidden = true;
    imageStatus.textContent = "";
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
    previousButton.disabled = index === 0;
    nextButton.disabled = index === steps.length - 1;
  }

  function imageUrl(value, base) {
    const url = new URL(value, base);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Gebruik een http(s)-URL of relatief pad voor afbeeldingen.");
    }
    return url.href;
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
        if (!step || typeof step.afbeelding !== "string" || !step.afbeelding.trim() ||
            typeof step.beschrijving !== "string" || !step.beschrijving.trim() ||
            (step.alt !== undefined && typeof step.alt !== "string")) {
          throw new Error(`Stap ${index + 1} mist een geldige afbeelding of beschrijving, of bevat ongeldige alt-tekst.`);
        }
        return { ...step, afbeelding: imageUrl(step.afbeelding, response.url || dataUrl.href) };
      });
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
    } catch (error) {
      status.textContent = `Kon het stappenplan niet laden: ${error.message}`;
      status.className = "error";
    }
  }

  load();
})();
