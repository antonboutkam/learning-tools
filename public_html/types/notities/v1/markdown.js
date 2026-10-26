(function (root) {
  "use strict";

  function format(text, start, end, command) {
    const selected = text.slice(start, end);
    const replace = (from, to, content, selectionStart = from, selectionEnd = from + content.length) => ({
      value: text.slice(0, from) + content + text.slice(to), start: selectionStart, end: selectionEnd
    });
    const inline = command === "code"
      ? "`".repeat(Math.max(1, ...Array.from(selected.matchAll(/`+/g), (match) => match[0].length + 1)))
      : { bold: "**", italic: "*", strike: "~~" }[command];
    if (inline) {
      const paddedMarker = inline + " ";
      if (command === "code" && text.slice(start - paddedMarker.length, start) === paddedMarker && text.slice(end, end + paddedMarker.length) === " " + inline) {
        return replace(start - paddedMarker.length, end + paddedMarker.length, selected);
      }
      const oddStars = (before, after) => (before.match(/\*+$/)?.[0].length || 0) % 2 === 1 && (after.match(/^\*+/)?.[0].length || 0) % 2 === 1;
      const surroundingItalic = command !== "italic" || oddStars(text.slice(0, start), text.slice(end));
      if (surroundingItalic && start >= inline.length && text.slice(start - inline.length, start) === inline && text.slice(end, end + inline.length) === inline) {
        return replace(start - inline.length, end + inline.length, selected);
      }
      const selectedItalic = command !== "italic" || oddStars(selected, selected);
      if (selectedItalic && selected.length >= inline.length * 2 && selected.startsWith(inline) && selected.endsWith(inline)) {
        return replace(start, end, selected.slice(inline.length, -inline.length));
      }
      const content = selected || (command === "code" ? "code" : "tekst");
      const pad = command === "code" && /^`|`$/.test(content) ? " " : "";
      return replace(start, end, inline + pad + content + pad + inline, start + inline.length + pad.length, start + inline.length + pad.length + content.length);
    }
    if (command === "link") {
      const label = (selected || "linktekst").replace(/[\r\n]+/g, " ").replace(/([\\\[\]])/g, "\\$1");
      const content = `[${label}](https://)`;
      const urlStart = start + label.length + 3;
      return replace(start, end, content, urlStart, urlStart + 8);
    }
    if (command === "codeblock") {
      const content = selected || "code";
      // Kies een fence die niet door backticks in de geselecteerde code wordt gesloten.
      const fence = "`".repeat(Math.max(3, ...Array.from(content.matchAll(/`+/g), (match) => match[0].length + 1)));
      const prefix = (start > 0 && text[start - 1] !== "\n" ? "\n" : "") + fence + "\n";
      const suffix = "\n" + fence + (end < text.length && text[end] !== "\n" ? "\n" : "");
      return replace(start, end, prefix + content + suffix, start + prefix.length, start + prefix.length + content.length);
    }
    if (command === "hr") return replace(start, end, "\n\n---\n\n", start + 7, start + 7);

    const prefixes = { h1: "# ", h2: "## ", h3: "### ", ul: "- ", checklist: "- [ ] ", quote: "> " };
    if (!(command in prefixes) && command !== "ol") return { value: text, start, end };
    const lineStart = start > 0 ? text.lastIndexOf("\n", start - 1) + 1 : 0;
    const lastSelected = end > start && text[end - 1] === "\n" ? end - 1 : end;
    const nextBreak = text.indexOf("\n", lastSelected);
    const lineEnd = nextBreak === -1 ? text.length : nextBreak;
    const lines = text.slice(lineStart, lineEnd).split("\n");
    const currentPattern = command === "ol" ? /^\d+\. / : new RegExp("^" + prefixes[command].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const populated = lines.filter((line) => line.trim());
    const remove = populated.length > 0 && populated.every((line) => currentPattern.test(line));
    let number = 0;
    const content = lines.map((line) => {
      if (remove) return line.replace(currentPattern, "");
      if (!line.trim() && lines.length > 1) return line;
      const clean = line.replace(/^(?:#{1,6} |[-+*] (?:\[[ xX]\] )?|\d+\. |> )/, "");
      const prefix = command === "ol" ? `${++number}. ` : prefixes[command];
      return prefix + (clean || (command.startsWith("h") ? "Kop" : "Item"));
    }).join("\n");
    if (lineStart === lineEnd) {
      const placeholder = command.startsWith("h") ? "Kop" : "Item";
      return replace(lineStart, lineEnd, content, lineStart + content.length - placeholder.length, lineStart + content.length);
    }
    return replace(lineStart, lineEnd, content);
  }

  if (typeof module === "object" && module.exports) module.exports = { format };
  else root.NotitiesMarkdown = { format };
})(typeof window === "undefined" ? globalThis : window);
