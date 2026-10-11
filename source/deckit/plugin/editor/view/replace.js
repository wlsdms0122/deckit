/* Only the matches ripgrep reported are replaced, at their line and column, and only if the text
 * there is unchanged. Re-matching in JavaScript would disagree with ripgrep (^, \s, word bounds). */
const patternOf = (query, { regex = false, caseSensitive = false, word = false } = {}) => {
  let src = regex ? String(query) : String(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (word) src = `\\b(?:${src})\\b`;
  return new RegExp(src, caseSensitive ? "g" : "gi");
};

const expandReplacement = (replacement, m) => replacement.replace(/\$(\$|&|<([^>]*)>|(\d{1,2}))/g, (all, what, name, digits) => {
  if (what === "$") return "$";
  if (what === "&") return m[0];
  if (name !== undefined) return m.groups?.[name] ?? "";
  const n = Number(digits);
  return n > 0 && n < m.length ? (m[n] ?? "") : all;
});

const planReplace = (lineOf, matches, { query, replacement, opts = {} }) => {
  const groups = opts.regex && replacement.includes("$");
  let sticky = null;
  if (groups) {
    // Word bounds were already checked by ripgrep.
    try { sticky = new RegExp(patternOf(query, { ...opts, word: false }).source, (opts.caseSensitive ? "" : "i") + "uy"); }
    catch { try { sticky = new RegExp(patternOf(query, { ...opts, word: false }).source, (opts.caseSensitive ? "" : "i") + "y"); } catch { sticky = null; } }
  }
  const edits = [];
  let skipped = 0, why = "";
  const skip = (reason) => { skipped += 1; why = why || reason; };
  for (const m of matches) {
    const line = lineOf(m.line);
    const hit = m.hit ?? (m.text || "").slice(m.col, m.col + m.length);
    if (!line || line.text.slice(m.col, m.col + m.length) !== hit) { skip("the text there changed after the search"); continue; }
    let insert = replacement;
    if (groups) {
      if (!sticky) { skip("the pattern is not one this replace can read groups from"); continue; }
      sticky.lastIndex = m.col;
      const found = sticky.exec(line.text);
      if (!found || found[0] !== hit) { skip("the pattern did not match there the same way"); continue; }
      insert = expandReplacement(replacement, found);
    }
    edits.push({ from: line.from + m.col, to: line.from + m.col + m.length, insert });
  }
  return { edits, skipped, why };
};

const linesOfText = (text) => {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (n) => {
    if (n < 1 || n > starts.length) return null;
    const end = n < starts.length ? starts[n] - 1 : text.length;
    return { from: starts[n - 1], text: text.slice(starts[n - 1], end).replace(/\r$/, "") };
  };
};

// From the end, so earlier offsets stay valid.
const applyEdits = (text, edits) => [...edits].sort((a, b) => b.from - a.from)
  .reduce((out, e) => out.slice(0, e.from) + e.insert + out.slice(e.to), text);
