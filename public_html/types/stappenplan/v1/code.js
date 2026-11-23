(function (root) {
  "use strict";

  // Voeg voor een nieuwe taal een tokenizer toe; onbekende talen blijven leesbare tekst.
  const tokenizers = {
    javascript: /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|\b(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|of|return|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b|\b(?:true|false|null|undefined)\b|\b(?:0[xX][\da-fA-F]+|0[bB][01]+|0[oO][0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?n?)\b/g
  };

  function tokens(source, language) {
    const pattern = tokenizers[language === "js" ? "javascript" : language];
    if (!pattern) return [{ text: source, type: "" }];
    const result = [];
    let offset = 0;
    for (const match of source.matchAll(pattern)) {
      if (match.index > offset) result.push({ text: source.slice(offset, match.index), type: "" });
      const text = match[0];
      const type = text.startsWith("//") || text.startsWith("/*") ? "comment"
        : /^["'`]/.test(text) ? "string" : /^\d/.test(text) ? "number"
        : /^(true|false|null|undefined)$/.test(text) ? "literal" : "keyword";
      result.push({ text, type });
      offset = match.index + text.length;
    }
    if (offset < source.length) result.push({ text: source.slice(offset), type: "" });
    return result;
  }

  function emphasisRanges(source, fragments) {
    const ranges = [];
    for (const fragment of fragments) {
      let start = source.indexOf(fragment);
      while (start !== -1) {
        ranges.push([start, start + fragment.length]);
        start = source.indexOf(fragment, start + 1);
      }
    }
    ranges.sort((a, b) => a[0] - b[0]);
    return ranges.reduce((merged, range) => {
      const last = merged[merged.length - 1];
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push(range.slice());
      return merged;
    }, []);
  }

  function render(element, config) {
    const doc = element.ownerDocument;
    const ranges = emphasisRanges(config.bron, config.nadruk || []);
    const nodes = [];
    let offset = 0;
    for (const token of tokens(config.bron, config.taal.toLowerCase())) {
      const end = offset + token.text.length;
      const boundaries = [offset, end];
      for (const [start, stop] of ranges) {
        if (start > offset && start < end) boundaries.push(start);
        if (stop > offset && stop < end) boundaries.push(stop);
      }
      boundaries.sort((a, b) => a - b);
      const span = doc.createElement("span");
      if (token.type) span.className = `syntax-${token.type}`;
      for (let i = 0; i < boundaries.length - 1; i++) {
        const start = boundaries[i];
        const text = config.bron.slice(start, boundaries[i + 1]);
        if (ranges.some(([from, to]) => start >= from && start < to)) {
          const strong = doc.createElement("strong");
          strong.textContent = text;
          span.append(strong);
        } else span.append(doc.createTextNode(text));
      }
      nodes.push(span);
      offset = end;
    }
    element.replaceChildren(...nodes);
  }

  const api = { tokens, emphasisRanges, render };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.StappenplanCode = api;
})(typeof window === "undefined" ? globalThis : window);
