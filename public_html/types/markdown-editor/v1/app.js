const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data");
let uniqueId = params.get("unique_id");

const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const introEl = document.getElementById("intro");
const statusEl = document.getElementById("status");
const editorEl = document.getElementById("editor");
const previewEl = document.getElementById("preview");
const countEl = document.getElementById("count");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const downloadDialogEl = document.getElementById("downloadDialog");
const downloadFormEl = document.getElementById("downloadForm");
const filenameInputEl = document.getElementById("filenameInput");
const filenameErrorEl = document.getElementById("filenameError");
const cancelDownloadBtn = document.getElementById("cancelDownloadBtn");

let renderRaf = null;
let defaultFilename = "README.md";

function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.className = isError ? "status error" : "status";
}

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isSafeLinkHref(href) {
  if (typeof href !== "string") return false;
  const raw = href.trim();
  if (!raw) return false;
  try {
    const u = new URL(raw, window.location.href);
    return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:" || u.protocol === "tel:";
  } catch {
    return false;
  }
}

function renderInline(text) {
  const source = escapeHtml(text);

  // Protect inline code spans from further formatting.
  const codeTokens = [];
  const withCode = source.replace(/`([^`]+)`/g, (_, code) => {
    const idx = codeTokens.push(`<code>${code}</code>`) - 1;
    return `\u0000CODE${idx}\u0000`;
  });

  // Links: [label](url)
  const withLinks = withCode.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safeLabel = label;
    const url = href.trim().replace(/^<|>$/g, "");
    if (!isSafeLinkHref(url)) return safeLabel;
    const safeHref = escapeHtml(url);
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
  });

  // Basic emphasis.
  let out = withLinks;
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  // Restore inline code.
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_, n) => codeTokens[Number(n)] || "");
  return out;
}

function splitLines(md) {
  return String(md ?? "").replace(/\r\n?/g, "\n").split("\n");
}

function fenceInfo(line) {
  const m = line.match(/^\s*```(\s*\S+)?\s*$/);
  if (!m) return null;
  return { lang: (m[1] || "").trim() };
}

function isHr(line) {
  return /^\s*([-*_])\1\1+\s*$/.test(line);
}

function headingInfo(line) {
  const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
  if (!m) return null;
  return { level: m[1].length, text: m[2] };
}

function listInfo(line) {
  const ul = line.match(/^\s*[-*+]\s+(.+?)\s*$/);
  if (ul) return { type: "ul", text: ul[1] };
  const ol = line.match(/^\s*\d+\.\s+(.+?)\s*$/);
  if (ol) return { type: "ol", text: ol[1] };
  return null;
}

function blockquoteLine(line) {
  const m = line.match(/^\s*>\s?(.*)$/);
  return m ? m[1] : null;
}

function renderBlocks(md, depth = 0) {
  if (depth > 4) return `<p>${renderInline(md)}</p>`;

  const lines = splitLines(md);
  const out = [];

  let i = 0;
  let inCode = false;
  let codeLines = [];

  function flushParagraph(buf) {
    const text = buf.join("\n").trimEnd();
    if (!text.trim()) return;
    const html = renderInline(text).replaceAll("\n", "<br />");
    out.push(`<p>${html}</p>`);
  }

  while (i < lines.length) {
    const line = lines[i];

    if (inCode) {
      if (fenceInfo(line)) {
        const code = escapeHtml(codeLines.join("\n"));
        out.push(`<pre><code>${code}</code></pre>`);
        inCode = false;
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      i += 1;
      continue;
    }

    if (fenceInfo(line)) {
      inCode = true;
      codeLines = [];
      i += 1;
      continue;
    }

    if (isHr(line)) {
      out.push("<hr />");
      i += 1;
      continue;
    }

    const h = headingInfo(line);
    if (h) {
      out.push(`<h${h.level}>${renderInline(h.text)}</h${h.level}>`);
      i += 1;
      continue;
    }

    const bq = blockquoteLine(line);
    if (bq !== null) {
      const quoteLines = [];
      while (i < lines.length) {
        const q = blockquoteLine(lines[i]);
        if (q === null) break;
        quoteLines.push(q);
        i += 1;
      }
      const inner = renderBlocks(quoteLines.join("\n"), depth + 1);
      out.push(`<blockquote>${inner}</blockquote>`);
      continue;
    }

    const li = listInfo(line);
    if (li) {
      const type = li.type;
      const items = [];
      while (i < lines.length) {
        const info = listInfo(lines[i]);
        if (!info || info.type !== type) break;
        items.push(`<li>${renderInline(info.text)}</li>`);
        i += 1;
      }
      out.push(`<${type}>${items.join("")}</${type}>`);
      continue;
    }

    if (!line.trim()) {
      // Blank line separates paragraphs.
      i += 1;
      continue;
    }

    // Paragraph: consume until blank line or block start.
    const buf = [];
    while (i < lines.length) {
      const cur = lines[i];
      if (!cur.trim()) break;
      if (fenceInfo(cur) || isHr(cur) || headingInfo(cur) || listInfo(cur) || blockquoteLine(cur) !== null) break;
      buf.push(cur);
      i += 1;
    }
    flushParagraph(buf);
  }

  if (inCode) {
    const code = escapeHtml(codeLines.join("\n"));
    out.push(`<pre><code>${code}</code></pre>`);
  }

  return out.join("");
}

function renderNow() {
  const md = editorEl.value || "";
  previewEl.innerHTML = renderBlocks(md);
  const chars = md.length;
  const lines = splitLines(md).length;
  countEl.textContent = `${lines} regels · ${chars} tekens`;
}

function sanitizeFilename(input) {
  const raw = safeText(input).trim();
  if (!raw) return "";
  // Remove path separators and control characters, plus Windows-forbidden chars.
  let out = raw.replaceAll(/[\\\/:*?"<>|\u0000-\u001F]/g, "");
  out = out.replaceAll(/\s+/g, " ").trim();
  // Avoid dot-only names.
  if (/^\.+$/.test(out)) return "";
  return out;
}

function downloadTextFile(filename, content) {
  const safeName = sanitizeFilename(filename) || "README.md";
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function scheduleRender() {
  if (renderRaf) cancelAnimationFrame(renderRaf);
  renderRaf = requestAnimationFrame(() => {
    renderRaf = null;
    renderNow();
  });
}

function setupEditorInteractions() {
  editorEl.addEventListener("input", scheduleRender);

  editorEl.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const start = editorEl.selectionStart;
    const end = editorEl.selectionEnd;
    const insert = "  ";
    editorEl.setRangeText(insert, start, end, "end");
    scheduleRender();
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(editorEl.value || "");
      setStatus("Markdown gekopieerd.");
      window.setTimeout(() => setStatus(""), 1200);
    } catch {
      setStatus("Kopiëren lukt niet in deze browser/iframe.", true);
    }
  });

  function openDownloadDialog() {
    filenameErrorEl.hidden = true;
    filenameInputEl.value = defaultFilename || "README.md";

    if (downloadDialogEl?.showModal) {
      downloadDialogEl.showModal();
      window.setTimeout(() => {
        filenameInputEl.focus();
        filenameInputEl.select();
      }, 0);
      return;
    }

    // Fallback for browsers without <dialog>.
    const name = window.prompt("Bestandsnaam:", filenameInputEl.value);
    if (name === null) return;
    const safeName = sanitizeFilename(name);
    if (!safeName) return;
    downloadTextFile(safeName, editorEl.value || "");
  }

  downloadBtn.addEventListener("click", openDownloadDialog);

  cancelDownloadBtn.addEventListener("click", () => {
    if (downloadDialogEl?.open) downloadDialogEl.close();
  });

  downloadDialogEl?.addEventListener("click", (e) => {
    if (e.target === downloadDialogEl) downloadDialogEl.close();
  });

  downloadFormEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const safeName = sanitizeFilename(filenameInputEl.value);
    if (!safeName) {
      filenameErrorEl.hidden = false;
      filenameInputEl.focus();
      filenameInputEl.select();
      return;
    }
    filenameErrorEl.hidden = true;
    downloadTextFile(safeName, editorEl.value || "");
    defaultFilename = safeName;
    downloadDialogEl.close();
  });
}

async function init() {
  setupEditorInteractions();

  if (!dataUrl) {
    setStatus("Geen data-URL opgegeven. Gebruik ?data=URL-naar-json", true);
    subtitleEl.textContent = "Data ontbreekt";
    editorEl.value = "";
    renderNow();
    return;
  }

  try {
    const res = await fetch(dataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!uniqueId && typeof data?.unique_id === "string" && data.unique_id.trim() !== "") {
      uniqueId = data.unique_id.trim();
    }

    if (typeof data?.defaultFilename === "string" && data.defaultFilename.trim() !== "") {
      const safeName = sanitizeFilename(data.defaultFilename);
      if (safeName) defaultFilename = safeName;
    }

    titleEl.textContent = safeText(data.title) || "Markdown editor";
    subtitleEl.textContent = uniqueId ? `ID: ${uniqueId}` : "Schrijf links, preview rechts.";

    const intro = safeText(data.intro);
    if (intro.trim()) {
      introEl.hidden = false;
      introEl.textContent = intro;
    } else {
      introEl.hidden = true;
    }

    editorEl.value = safeText(data.markdown);
    if (data.readOnly === true) {
      editorEl.setAttribute("readonly", "readonly");
      copyBtn.disabled = false;
    }
    renderNow();
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Kan data niet laden. Controleer de data-URL.", true);
    subtitleEl.textContent = "Fout";
    editorEl.value = "";
    renderNow();
  }
}

init();
