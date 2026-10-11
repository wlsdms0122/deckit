const editorLook = (engine, theme, ui) => {
  // The theme gives colours, not whether it is dark; contentBg comes as "#1a1d21" or "rgb(26, 29, 33)".
  const dark = (() => {
    const raw = String(theme.contentBg || "").trim();
    let rgb = null;
    const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const h = hex[1].length === 3 ? hex[1].replace(/./g, (x) => x + x) : hex[1];
      rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    } else {
      const m = raw.match(/\d+(\.\d+)?/g);
      if (m && m.length >= 3) rgb = m.slice(0, 3).map(Number);
    }
    if (!rgb) return true;
    const [r, g, b] = rgb;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
  })();

  const C = dark
    ? { keyword: "#c678dd", string: "#98c379", number: "#d19a66", comment: "#7f848e", fn: "#61afef",
        type: "#e5c07b", prop: "#e06c75", op: "#56b6c2", meta: "#abb2bf", invalid: "#ff6b6b" }
    : { keyword: "#cf222e", string: "#0a3069", number: "#0550ae", comment: "#6e7781", fn: "#8250df",
        type: "#953800", prop: "#116329", op: "#0550ae", meta: "#57606a", invalid: "#cf222e" };
  const t = engine.tags;
  const specs = [
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword, t.modifier], color: C.keyword },
    { tag: [t.string, t.special(t.string), t.regexp, t.character], color: C.string },
    { tag: [t.number, t.bool, t.null, t.atom, t.unit], color: C.number },
    { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: C.comment, fontStyle: "italic" },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: C.fn },
    { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: C.type },
    { tag: [t.propertyName, t.attributeName, t.labelName], color: C.prop },
    { tag: [t.operator, t.derefOperator, t.escape], color: C.op },
    { tag: [t.meta, t.processingInstruction, t.annotation], color: C.meta },
    { tag: [t.tagName, t.heading], color: C.prop, fontWeight: "600" },
    { tag: [t.link, t.url], color: C.fn, textDecoration: "underline" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strong, fontWeight: "700" },
    { tag: t.invalid, color: C.invalid },
  ];
  const style = engine.HighlightStyle.define(specs);
  // Classes are the colours themselves: the minimap paints them rather than styling text.
  const ink = engine.tagHighlighter(specs.filter((x) => x.color).map((x) => ({ tag: x.tag, class: x.color })));

  const look = engine.EditorView.theme({
    "&": { height: "100%", color: theme.contentColor, backgroundColor: "transparent" },
    "&.cm-focused": { outline: "none" },
    ".cm-content": { caretColor: ui.accent, padding: "8px 0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: ui.accent, borderLeftWidth: "2px" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection":
      { backgroundColor: ui.alpha(ui.accent, 0.28) },
    // Transparent: lines scrolled sideways are clipped at its edge instead (clipGutter in view.js).
    ".cm-gutters": { backgroundColor: "transparent", color: ui.blend(theme.contentColor, theme.contentBg, 0.4), border: "0" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: theme.contentColor },
    ".cm-activeLine": { backgroundColor: "rgba(128,128,128,.07)" },
    /* The engine draws a partial-line selection at letter height and this band at line height, so
       the two never meet; the band steps aside while text is selected. */
    "&.sk-selecting .cm-activeLine, &.sk-selecting .cm-activeLineGutter": { backgroundColor: "transparent" },
    ".cm-matchingBracket": { backgroundColor: ui.alpha(ui.accent, 0.22), outline: "none" },
    ".cm-selectionMatch": { backgroundColor: "rgba(128,128,128,.18)" },
    ".cm-searchMatch": { backgroundColor: ui.alpha("#ecb22e", 0.35), outline: "none" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: ui.alpha("#ecb22e", 0.7) },
    // Quieted by colour, not opacity, so the hover square does not fade with the glyph.
    ".cm-foldGutter .cm-gutterElement": { display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px 0 2px" },
    ".cm-foldGutter .sk-fold-open, .cm-foldGutter .sk-fold-closed": {
      cursor: "pointer", color: ui.blend(theme.contentColor, theme.contentBg, 0.4),
      transition: `background-color ${ui.motion.fast} ${ui.motion.ease}, color ${ui.motion.fast} ${ui.motion.ease}`,
    },
    ".cm-foldGutter .sk-fold-closed": { color: theme.contentColor },
    ".cm-foldGutter .sk-fold-open:hover, .cm-foldGutter .sk-fold-closed:hover": { color: theme.contentColor, backgroundColor: "rgba(128,128,128,.18)" },
    ".cm-foldPlaceholder": {
      backgroundColor: "rgba(128,128,128,.2)", border: "0", borderRadius: "5px", color: "inherit",
      padding: "0 6px", margin: "0 3px", cursor: "pointer",
      transition: `background-color ${ui.motion.fast} ${ui.motion.ease}`,
    },
    ".cm-foldPlaceholder:hover": { backgroundColor: "rgba(128,128,128,.34)" },
    ".cm-panels": { backgroundColor: "rgba(128,128,128,.06)", color: theme.contentColor },
    ".cm-panels.cm-panels-top": { borderBottom: theme.border },
    ".cm-tooltip": { backgroundColor: theme.contentBg, border: theme.border, color: theme.contentColor },
  }, { dark });

  return { look: [look, engine.syntaxHighlighting(style)], ink };
};

const EDITOR_MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const EDITOR_FONTS = [
  { value: "system", label: "System (SF Mono)" },
  ...["Menlo", "Monaco", "JetBrains Mono", "Fira Code", "Source Code Pro", "D2Coding", "Cascadia Code",
      "IBM Plex Mono", "Hack", "Inconsolata", "Roboto Mono", "Ubuntu Mono", "Courier New"].map((name) => ({ value: name, label: name, font: `"${name}"` })),
];

// Line height in whole pixels: a fractional one makes the selection layer drift off the lines.
const editorType = (engine, { size = 13, font = "system" } = {}) => {
  const chosen = EDITOR_FONTS.find((f) => f.value === font)?.font;
  const face = chosen ? `${chosen}, ${EDITOR_MONO}` : EDITOR_MONO;
  return engine.EditorView.theme({
    "&": { fontSize: size + "px" },
    ".cm-scroller": { fontFamily: face, lineHeight: Math.round(size * 1.55) + "px" },
  });
};
