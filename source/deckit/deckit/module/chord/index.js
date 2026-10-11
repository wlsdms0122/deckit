DeckitModule.define("deckit/module/chord", {
  uses: [],
  provides: [
    "parse", "normal", "label", "matches", "fromEvent", "editsText", "record", "cancels", "clears",
    "endsRecording",
  ],
  runs: "any",
}, () => {
  const NAMED = {
    left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown",
    enter: "Enter", escape: "Escape", space: "Space", tab: "Tab", backspace: "Backspace",
    delete: "Delete", "[": "BracketLeft", "]": "BracketRight", ",": "Comma", ".": "Period",
    "/": "Slash", "\\": "Backslash", "-": "Minus", "=": "Equal", ";": "Semicolon",
    "'": "Quote", "`": "Backquote",
  };
  const TOKEN = Object.fromEntries(Object.entries(NAMED).map(([k, v]) => [v, k]));

  // A chord is matched on the physical key (`code`), since a modifier can change the character typed.
  const codeOf = (token) =>
    /^[a-z]$/.test(token) ? "Key" + token.toUpperCase() :
    /^[0-9]$/.test(token) ? "Digit" + token :
    /^f([1-9]|1[0-9])$/.test(token) ? token.toUpperCase() :
    NAMED[token] || null;

  const tokenOf = (code) =>
    /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() :
    /^Digit[0-9]$/.test(code) ? code.slice(5) :
    /^F([1-9]|1[0-9])$/.test(code) ? code.toLowerCase() :
    TOKEN[code] || null;

  const MAC = typeof process !== "undefined" && process.platform
    ? process.platform === "darwin"
    : /Mac/i.test((typeof navigator !== "undefined" && navigator.platform) || "");

  const parse = (spec) => {
    const chord = { code: null, meta: false, ctrl: false, shift: false, alt: false };
    for (const raw of String(spec || "").toLowerCase().split("+")) {
      // "mod++" (a plus key) is not supported: split cannot tell it from a typo.
      const token = raw.trim();
      if (!token) continue;
      if (token === "mod") { if (MAC) chord.meta = true; else chord.ctrl = true; }
      else if (token === "cmd" || token === "meta") chord.meta = true;
      else if (token === "ctrl" || token === "control") chord.ctrl = true;
      else if (token === "shift") chord.shift = true;
      else if (token === "alt" || token === "opt" || token === "option") chord.alt = true;
      // A second key or an unknown word refuses the whole spec, so a typo is not bound as another chord.
      else if (chord.code) return null;
      else if (!(chord.code = codeOf(token))) return null;
    }
    return chord.code ? chord : null;
  };

  // One spelling per chord, so two specs compare as strings: "ctrl+alt+shift+cmd+t".
  const normal = (spec) => {
    const c = parse(spec);
    if (!c) return null;
    return [c.ctrl && "ctrl", c.alt && "alt", c.shift && "shift", c.meta && "cmd", tokenOf(c.code)].filter(Boolean).join("+");
  };

  const SYMBOL = { backspace: "⌫", delete: "⌦", enter: "↩", escape: "⎋", tab: "⇥",
    left: "←", right: "→", up: "↑", down: "↓" };

  // In the order macOS writes them, ⌃⌥⇧⌘.
  const label = (spec) => {
    const c = parse(spec);
    if (!c) return "";
    const key = tokenOf(c.code);
    const name = MAC && SYMBOL[key] ? SYMBOL[key] : key.length === 1 ? key.toUpperCase() : key.replace(/^./, (x) => x.toUpperCase());
    return MAC
      ? (c.ctrl ? "\u2303" : "") + (c.alt ? "\u2325" : "") + (c.shift ? "\u21e7" : "") + (c.meta ? "\u2318" : "") + name
      : (c.ctrl ? "Ctrl+" : "") + (c.alt ? "Alt+" : "") + (c.shift ? "Shift+" : "") + (c.meta ? "Win+" : "") + name;
  };

  // `input` has Electron's before-input-event shape ({ code, meta, control, shift, alt }).
  const matches = (chord, input) => !!chord && chord.code === input.code &&
    !!chord.meta === !!input.meta && !!chord.ctrl === !!input.control &&
    !!chord.shift === !!input.shift && !!chord.alt === !!input.alt;

  const fromEvent = (e) => ({ code: e.code, meta: e.metaKey, control: e.ctrlKey, shift: e.shiftKey, alt: e.altKey });

  /* Keys a focused text field owns whatever a plugin binds them to: caret moves and deletion with
     any modifier (⌘← is the start of the line), and the ⌘ edit commands. */
  const EDITING = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", "Backspace", "Delete"]);
  const EDIT_COMMANDS = new Set(["KeyA", "KeyC", "KeyX", "KeyV", "KeyZ"]);
  const editsText = (input) => EDITING.has(input.code) || (!!input.meta && !input.control && !input.alt && EDIT_COMMANDS.has(input.code));

  /* A bare key is refused: bound, it would take that letter from every field on the screen.
     Function keys are allowed, since nothing types them. */
  const record = (input) => {
    if (/^(Meta|Control|Shift|Alt)(Left|Right)?$/.test(input.code)) return { pending: true };
    const key = tokenOf(input.code);
    if (!key) return { error: "That key cannot be bound" };
    if (!input.meta && !input.control && !input.alt && !/^f\d+$/.test(key)) return { error: MAC ? "Add \u2318, \u2303 or \u2325" : "Add Ctrl or Alt" };
    return { spec: normal([input.control && "ctrl", input.alt && "alt", input.shift && "shift", input.meta && "cmd", key].filter(Boolean).join("+")) };
  };

  // Main and the page both ask this, so a recording ends on the same key in both.
  const bare = (input) => !input.meta && !input.control && !input.alt && !input.shift;
  const cancels = (input) => bare(input) && input.code === "Escape";
  const clears = (input) => bare(input) && (input.code === "Backspace" || input.code === "Delete");
  const endsRecording = (input) => cancels(input) || clears(input) || !!record(input).spec;

  return Object.freeze({ parse, normal, label, matches, fromEvent, editsText, record, cancels, clears, endsRecording });
});
