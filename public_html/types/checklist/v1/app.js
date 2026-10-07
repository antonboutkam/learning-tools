(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const dataUrl = new URL(params.get("data") || "example.json", window.location.href).href;
  const el = Object.fromEntries([
    "checklist", "title", "status", "items", "empty", "addition", "newLabel", "newUrl",
    "export", "exportFormat", "download", "reset", "actions"
  ].map((id) => [id, document.getElementById(id)]));
  let config;
  let items = [];
  let initialItems = [];
  let storageKey = null;

  function status(message = "", error = false) {
    el.status.textContent = message;
    el.status.classList.toggle("error", error);
  }

  function safeUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value.trim(), dataUrl);
      return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function validItems(value) {
    return Array.isArray(value) && value.every((item) => item &&
      typeof item.label === "string" && item.label.trim() && typeof item.checked === "boolean" &&
      (item.url === undefined || typeof item.url === "string"));
  }

  function copyItems(value) {
    return value.map((item) => ({ label: item.label, checked: item.checked,
      ...(item.url?.trim() ? { url: item.url.trim() } : {}) }));
  }

  function save() {
    if (!storageKey || config.readOnly) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, initialItems, items }));
    } catch {
      status("Je wijzigingen kunnen niet in deze browser worden bewaard.", true);
    }
  }

  function restore() {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved?.version === 1 && JSON.stringify(saved.initialItems) === JSON.stringify(initialItems) && validItems(saved.items)) {
        items = copyItems(saved.items);
      }
    } catch {
      // Een beschadigde of ontoegankelijke opslag verhindert het gebruik niet.
    }
  }

  function renderItems(focusIndex = null) {
    el.items.replaceChildren();
    items.forEach((item, index) => {
      const row = document.createElement("li");
      row.className = "item";
      const checkbox = document.createElement("input");
      checkbox.className = "item__checkbox";
      checkbox.type = "checkbox";
      checkbox.id = `checklist-item-${index}`;
      checkbox.checked = item.checked;
      checkbox.disabled = config.readOnly;
      checkbox.addEventListener("change", () => {
        if (config.readOnly) {
          checkbox.checked = item.checked;
          return;
        }
        item.checked = checkbox.checked;
        status();
        save();
      });
      const label = document.createElement("label");
      label.className = "item__label";
      label.htmlFor = checkbox.id;
      const url = safeUrl(item.url);
      if (url) {
        const link = document.createElement("a");
        link.textContent = item.label;
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        label.append(link);
      } else {
        label.textContent = item.label;
      }
      row.append(checkbox, label);
      if (config.allowDeletion && !config.readOnly) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "item__delete";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Verwijder ${item.label}`);
        remove.title = `Verwijder ${item.label}`;
        remove.addEventListener("click", () => {
          if (config.readOnly) return;
          items.splice(index, 1);
          status("Item verwijderd.");
          save();
          renderItems(Math.min(index, items.length - 1));
        });
        row.append(remove);
      }
      el.items.append(row);
    });
    el.empty.hidden = items.length > 0;
    if (focusIndex !== null) {
      const checkbox = el.items.querySelectorAll("input")[focusIndex];
      (checkbox || (config.allowAddition ? el.newLabel : el.reset)).focus();
    }
  }

  function markdownText(value) {
    return value.replace(/[\r\n]+/g, " ").replace(/([\\`*_{}\[\]<>#|~])/g, "\\$1");
  }

  function exportContent(format) {
    const title = config.title || "";
    if (format === "json") return JSON.stringify({ title, items: copyItems(items) }, null, 2) + "\n";
    const heading = title ? `${format === "md" ? "# " + markdownText(title) : title}\n\n` : "";
    return heading + items.map((item) => {
      let label = format === "md" ? markdownText(item.label) : item.label.replace(/[\r\n]+/g, " ");
      const url = safeUrl(item.url);
      if (url) {
        label = format === "md" ? `[${label}](<${url.replace(/[<>]/g, (char) => encodeURIComponent(char))}>)` : `${label} (${url})`;
      }
      return `${format === "md" ? "- " : ""}[${item.checked ? "x" : " "}] ${label}`;
    }).join("\n") + "\n";
  }

  el.newLabel.addEventListener("input", () => el.newLabel.setCustomValidity(""));
  el.newUrl.addEventListener("input", () => el.newUrl.setCustomValidity(""));
  el.addition.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!config?.allowAddition || config.readOnly) return;
    const label = el.newLabel.value.trim();
    const url = el.newUrl.value.trim();
    if (!label || (url && !safeUrl(url))) {
      const field = !label ? el.newLabel : el.newUrl;
      field.setCustomValidity(!label ? "Vul een label in." : "Vul een geldige URL in (http, https, mailto of tel).");
      field.reportValidity();
      return;
    }
    items.push({ label, checked: false, ...(url ? { url } : {}) });
    el.addition.reset();
    status("Item toegevoegd.");
    save();
    renderItems();
    el.newLabel.focus();
  });

  el.reset.addEventListener("click", () => {
    if (!config?.rememberState || config.readOnly) return;
    items = copyItems(initialItems);
    status("De oorspronkelijke checklist is teruggezet.");
    if (storageKey) {
      try { localStorage.removeItem(storageKey); }
      catch { status("De checklist is teruggezet, maar de browseropslag kon niet worden gewist.", true); }
    }
    renderItems();
  });

  el.download.addEventListener("click", () => {
    if (!config?.allowExport) return;
    const format = el.exportFormat.value;
    const mime = { md: "text/markdown", txt: "text/plain", json: "application/json" }[format];
    if (!mime) return;
    const url = URL.createObjectURL(new Blob([exportContent(format)], { type: `${mime};charset=utf-8` }));
    const link = document.createElement("a");
    link.href = url;
    const filename = (config.title || "checklist").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "checklist";
    link.download = `${filename}.${format}`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("De checklist is geëxporteerd.");
  });

  async function init() {
    try {
      const response = await fetch(dataUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || !validItems(data.items)) throw new Error("Ongeldige checklistitems");
      config = {
        title: typeof data.title === "string" ? data.title : "",
        readOnly: data.readOnly === true,
        rememberState: data.rememberState === true,
        allowExport: data.allowExport === true,
        allowAddition: data.allowAddition === true,
        allowDeletion: data.allowDeletion === true,
        checkboxPosition: data.checkboxPosition === "right" ? "right" : "left",
        showLabel: data.showLabel !== false
      };
      initialItems = copyItems(data.items);
      items = copyItems(initialItems);
      const id = params.get("unique_id") || data.unique_id || dataUrl;
      storageKey = config.rememberState ? `learning-tools:checklist:v1:${id}` : null;
      restore();
      el.title.textContent = config.title;
      el.title.hidden = !config.showLabel || !config.title.trim();
      el.checklist.setAttribute("aria-label", config.title || "Checklist");
      el.checklist.classList.toggle("checkboxes-right", config.checkboxPosition === "right");
      el.checklist.classList.toggle("read-only", config.readOnly);
      el.addition.hidden = !config.allowAddition || config.readOnly;
      el.export.hidden = !config.allowExport;
      el.reset.hidden = !config.rememberState || config.readOnly;
      el.actions.hidden = !config.allowExport && el.reset.hidden;
      status();
      renderItems();
    } catch {
      status("De checklist kon niet worden geladen. Controleer de JSON-configuratie en de data-URL.", true);
    }
  }

  init();
})();
