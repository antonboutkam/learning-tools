const assert = require("node:assert/strict");
const test = require("node:test");
const { format } = require("./markdown.js");

test("inline opmaak behoudt omliggende tekst en kan worden teruggedraaid", () => {
  for (const [command, marker] of [["bold", "**"], ["italic", "*"], ["strike", "~~"], ["code", "`"]]) {
    const formatted = format("voor tekst na", 5, 10, command);
    assert.equal(formatted.value, `voor ${marker}tekst${marker} na`);
    assert.equal(formatted.value.slice(formatted.start, formatted.end), "tekst");
    const undone = format(formatted.value, formatted.start, formatted.end, command);
    assert.equal(undone.value, "voor tekst na");
  }
});

test("vet en cursief kunnen gecombineerd en afzonderlijk verwijderd worden", () => {
  const bold = format("tekst", 0, 5, "bold");
  const both = format(bold.value, bold.start, bold.end, "italic");
  assert.equal(both.value, "***tekst***");
  assert.equal(format(both.value, both.start, both.end, "italic").value, "**tekst**");
  assert.equal(format(both.value, both.start, both.end, "bold").value, "*tekst*");
  assert.equal(format("**tekst**", 0, 9, "italic").value, "***tekst***");
});

test("koppen wijzigen de volledige regel en vervangen bestaande blokopmaak", () => {
  assert.equal(format("voor\n- Onderwerp\nna", 9, 12, "h2").value, "voor\n## Onderwerp\nna");
  for (const [command, prefix] of [["h1", "# "], ["h2", "## "], ["h3", "### "]]) {
    const formatted = format("Onderwerp", 3, 3, command);
    assert.equal(formatted.value, prefix + "Onderwerp");
    assert.equal(format(formatted.value, 0, formatted.value.length, command).value, "Onderwerp");
  }
});

test("lijsten passen geselecteerde regels aan zonder de volgende regel mee te nemen", () => {
  const text = "één\ntwee\nvolgende";
  assert.equal(format(text, 0, 9, "ul").value, "- één\n- twee\nvolgende");
  const ordered = format(text, 0, 9, "ol");
  assert.equal(ordered.value, "1. één\n2. twee\nvolgende");
  assert.equal(format(ordered.value, ordered.start, ordered.end, "ol").value, text);
  assert.equal(format("één\n\ntwee", 0, 9, "checklist").value, "- [ ] één\n\n- [ ] twee");
  assert.equal(format("citaat", 0, 6, "quote").value, "> citaat");
});

test("lege invoer selecteert de placeholder en laat Markdowntekens staan", () => {
  for (const command of ["bold", "h1", "ul", "ol", "quote"]) {
    const formatted = format("", 0, 0, command);
    assert.ok(["tekst", "Kop", "Item"].includes(formatted.value.slice(formatted.start, formatted.end)));
  }
  const formatted = format("\nvolgende", 0, 0, "h1");
  assert.equal(formatted.value, "# Kop\nvolgende");
});

test("links selecteren de URL; codeblokken beschermen aanwezige backticks", () => {
  const link = format("een [link]", 0, 10, "link");
  assert.equal(link.value, "[een \\[link\\]](https://)");
  assert.equal(link.value.slice(link.start, link.end), "https://");
  const code = format("voor code``` na", 5, 12, "codeblock");
  assert.equal(code.value, "voor \n````\ncode```\n````\n na");
  assert.equal(code.value.slice(code.start, code.end), "code```");
  const inline = format("`naam`", 0, 6, "code");
  assert.equal(inline.value, "`` `naam` ``");
  assert.equal(format(inline.value, inline.start, inline.end, "code").value, "`naam`");
});
