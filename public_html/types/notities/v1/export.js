(function (root) {
  "use strict";

  const heading = (text) => String(text).replace(/[\r\n]+/g, " ").replace(/([\\`*_{}\[\]<>#|])/g, "\\$1");
  const filename = (text) => String(text).normalize("NFC").replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "tabblad";
  const hasInk = (strokes) => Array.isArray(strokes) && strokes.some((stroke) => stroke.points?.length >= 2);

  function sections(snapshot) {
    const bookmarks = [...snapshot.bookmarks].sort((a, b) => a.pageIndex - b.pageIndex || a.slot - b.slot);
    const groups = bookmarks.map((bookmark) => ({ name: bookmark.name || "Tabblad", bookmark, pages: [] }));
    const untabbed = { name: bookmarks.length ? "Zonder tabblad" : "Notities", pages: [] };
    for (const page of snapshot.pages) {
      if (!page.text.trim() && !hasInk(page.strokes)) continue;
      const candidates = groups.filter((group) => group.bookmark.pageIndex <= page.pageIndex);
      candidates.sort((a, b) => b.bookmark.pageIndex - a.bookmark.pageIndex || a.bookmark.slot - b.bookmark.slot);
      (candidates[0] || untabbed).pages.push(page);
    }
    if (untabbed.pages.length || !groups.length) groups.unshift(untabbed);
    return groups;
  }

  function markdownSection(group, image) {
    const lines = [`## ${heading(group.name)}`, ""];
    if (hasInk(group.bookmark?.strokes)) lines.push(`![Pentekening tabblad](${image(group.bookmark.strokes, "bookmark", group.bookmark.bookmarkId)})`, "");
    for (const page of group.pages) {
      lines.push(`### Pagina ${page.pageIndex + 1}`, "", page.text, "");
      if (hasInk(page.strokes)) lines.push(`![Pentekening pagina ${page.pageIndex + 1}](${image(page.strokes, "page", page.pageIndex)})`, "");
    }
    if (!group.pages.length && !hasInk(group.bookmark?.strokes)) lines.push("*Geen aantekeningen.*", "");
    return lines.join("\n");
  }

  function markdown(snapshot, image) {
    return `# ${heading(snapshot.notebook.title || "Notities")}\n\n` + sections(snapshot).map((group) => markdownSection(group, image)).join("\n");
  }

  function plainText(snapshot) {
    const lines = [snapshot.notebook.title || "Notities", ""];
    for (const group of sections(snapshot)) {
      lines.push(group.name, "=".repeat(Math.min(group.name.length, 60)), "");
      if (hasInk(group.bookmark?.strokes)) lines.push("[Pentekening op tabblad; beschikbaar in JSON en Markdown.]", "");
      for (const page of group.pages) {
        lines.push(`Pagina ${page.pageIndex + 1}`, page.text, "");
        if (hasInk(page.strokes)) lines.push("[Pentekening op deze pagina; beschikbaar in JSON en Markdown.]", "");
      }
      if (!group.pages.length && !hasInk(group.bookmark?.strokes)) lines.push("Geen aantekeningen.", "");
    }
    return lines.join("\n");
  }

  // ZIP met opgeslagen (ongecomprimeerde) bestanden, UTF-8 namen en CRC-32.
  // Geen externe library of netwerk nodig; PNG-afbeeldingen zijn al gecomprimeerd.
  function zip(files) {
    if (files.length > 65535) throw new Error("Te veel bestanden voor ZIP-export.");
    const encoder = new TextEncoder();
    const local = [], central = [];
    let offset = 0, centralSize = 0;
    const crc32 = (bytes) => {
      let crc = 0xffffffff;
      for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
      return (crc ^ 0xffffffff) >>> 0;
    };
    for (const file of files) {
      const name = encoder.encode(file.name);
      const content = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
      if (name.length > 65535 || offset + content.length + name.length + 30 > 0xffffffff) throw new Error("ZIP-export is te groot.");
      const crc = crc32(content);
      const header = new Uint8Array(30), h = new DataView(header.buffer);
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint16(12, 33, true); h.setUint32(14, crc, true);
      h.setUint32(18, content.length, true); h.setUint32(22, content.length, true); h.setUint16(26, name.length, true);
      const entry = new Uint8Array(46), c = new DataView(entry.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(14, 33, true); c.setUint32(16, crc, true);
      c.setUint32(20, content.length, true); c.setUint32(24, content.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      local.push(header, name, content); central.push(entry, name);
      offset += header.length + name.length + content.length;
      centralSize += entry.length + name.length;
    }
    if (offset + centralSize > 0xffffffff) throw new Error("ZIP-export is te groot.");
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
    return new Blob([...local, ...central, end], { type: "application/zip" });
  }

  function markdownZip(snapshot, image) {
    const files = [];
    sections(snapshot).forEach((group, index) => {
      const prefix = `${String(index + 1).padStart(2, "0")}_${filename(group.name)}`;
      const renderImage = (strokes, kind, id) => {
        const name = `afbeeldingen/${prefix}_${kind}_${filename(id)}.png`;
        const base64 = image(strokes, kind, id).split(",")[1];
        files.push({ name, content: Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)) });
        return name;
      };
      files.push({ name: `${prefix}.md`, content: `# ${heading(snapshot.notebook.title || "Notities")}\n\n${markdownSection(group, renderImage)}` });
    });
    return zip(files);
  }

  const api = { sections, markdown, plainText, markdownZip, zip };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NotitiesExport = api;
})(typeof window === "undefined" ? globalThis : window);
