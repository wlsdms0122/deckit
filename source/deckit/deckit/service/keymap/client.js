DeckitModule.define("deckit/service/keymap/client", {
  uses: [
    "deckit/service/home/model/config",
    "deckit/module/chord",
    "deckit/service/keymap/model/global",
    "deckit/service/keymap/model/protocol",
  ],
  provides: [
    "register", "arrange", "list", "live", "connect", "publish", "chord", "set", "reset", "on",
    "record",
  ],
}, (CONFIG, CHORD, HOST, PROTOCOL) => {
  let overrides = (() => { try { return PROTOCOL.overrides.ask() || {}; } catch { return {}; } })();
  const scopes = [];   // in the order they registered
  const listeners = new Set();

  const has = (id) => Object.prototype.hasOwnProperty.call(overrides, id);
  const effective = (id, key) => {
    const own = has(id) ? overrides[id] : key;
    return own ? CHORD.normal(own) : null;
  };

  // Validated once at registration: the list is read on every switch and every Settings render.
  const declared = (keys, invalid, mayBeGlobal) => Object.entries(keys || {}).flatMap(([action, entry]) => {
    const key = entry && CHORD.normal(entry.key);
    if (!key || typeof entry.run !== "function") {
      invalid(`key "${action}" cannot be used: it needs a chord in "key" and a function in "run"`);
      return [];
    }
    // A global key is taken from every page, fields included, so it must not be one that types or edits text.
    const chord = CHORD.parse(key);
    if (entry.global && mayBeGlobal !== true) {
      invalid(`key "${action}" cannot be global${mayBeGlobal ? ": " + mayBeGlobal : ""}`);
      return [];
    }
    if (entry.global && (!(chord.meta || chord.ctrl || chord.alt)
        || CHORD.editsText({ code: chord.code, meta: chord.meta, control: chord.ctrl, alt: chord.alt }))) {
      invalid(`key "${action}" cannot be global: a global key needs \u2318, \u2303 or \u2325, and none a text field uses`);
      return [];
    }
    return [{ action, key, label: entry.label || action, run: entry.run, global: !!entry.global }];
  });
  const register = ({ id, name, keys, everywhere = false, global = false, invalid } = {}) => {
    if (!id || scopes.some((s) => s.id === id)) return console.warn("[deckit] a key scope needs an id of its own", id);
    const say = typeof invalid === "function" ? invalid : (why) => console.warn(`[deckit] ${id}: ${why}`);
    scopes.push({ id: String(id), name: String(name || id), everywhere: !!everywhere, keys: declared(keys, say, global) });
    tellGlobals();
  };
  const arrange = (ids) => {
    const at = new Map([...ids].map((id, i) => [id, i]));
    const rank = (x) => (at.has(x.id) ? at.get(x.id) : Infinity);
    scopes.sort((a, b) => rank(a) - rank(b));
    // The order decides which of two global keys on one chord runs.
    announce();
  };

  const binding = (owner, ownerName, scope, { action, key: written, label, run }) => {
    const id = owner + "." + action;
    const key = CHORD.normal(written);
    const spec = effective(id, key);
    return {
      id, owner, ownerName, scope, action, label, key, spec, run,
      // Against today's default: a change a plugin update has since made its default is no longer a change.
      chord: spec ? CHORD.label(spec) : "", defaultChord: key ? CHORD.label(key) : "", changed: has(id) && spec !== key,
    };
  };

  // Global ones first, in the order main tries them; all() relies on this order to pick winners.
  const keysOf = (global) => (s) => s.keys.filter((k) => k.global === global);
  const catalog = () => [
    ...Object.entries(HOST.GLOBAL).map(([id, g]) =>
      binding("host", CONFIG.name, "global", { action: id.slice(5), key: g.key, label: g.label, run: null })),
    ...scopes.flatMap((s) => keysOf(true)(s).map((k) => binding(s.id, s.name, "global", k))),
    ...scopes.filter((s) => s.everywhere).flatMap((s) => keysOf(false)(s).map((k) => binding(s.id, s.name, "panel", k))),
    ...scopes.filter((s) => !s.everywhere).flatMap((s) => keysOf(false)(s).map((k) => binding(s.id, s.name, "plugin", k))),
  ];

  const together = (a, b) => !(a.scope === "plugin" && b.scope === "plugin" && a.owner !== b.owner);
  const nameOf = (o) => (o.owner === "host" ? o.label : `${o.ownerName} ${o.label}`);

  /* Defaults first, then changes in the order they were made (the saved map's order), so a change
     landing on a taken chord is the one held back. Among defaults nothing is held back; the
     "Never runs" and "Hides" checks mirror how a keystroke is actually resolved. */
  const all = () => {
    const list = catalog();
    const order = Object.keys(overrides);
    const rank = (b) => (b.changed ? order.indexOf(b.id) : -1);
    const at = new Map(list.map((b, i) => [b.id, i]));
    const issues = new Map(list.map((b) => [b.id, []]));
    const say = (b, level, text) => issues.get(b.id).push({ level, text });
    const held = new Set();
    const accepted = [];
    for (const b of [...list].sort((x, y) => rank(x) - rank(y) || at.get(x.id) - at.get(y.id))) {
      if (!b.spec) continue;
      const taken = accepted.find((o) => o.spec === b.spec && together(o, b));
      if (taken && b.changed) {
        held.add(b.id);
        say(b, "error", `Not applied: ${taken.chord} is already ${nameOf(taken)}`);
        continue;
      }
      accepted.push(b);
    }
    for (const b of accepted) {
      for (const o of accepted) {
        if (o === b || o.spec !== b.spec || !together(o, b)) continue;
        if (o.scope === "global" && b.scope !== "global") say(b, "error", `Never runs: ${o.chord} is ${nameOf(o)}`);
        else if (b.scope === "global" && o.scope === "global" && at.get(o.id) < at.get(b.id)) say(b, "error", `Never runs: ${o.chord} is ${nameOf(o)}`);
        else if (b.scope !== "global" && o.owner === b.owner && o.scope === b.scope && at.get(o.id) < at.get(b.id)) say(b, "error", `Never runs: ${o.chord} is ${o.label}`);
        else if (b.scope === "plugin" && o.scope === "panel") say(b, "warn", `Hides ${o.label} while ${b.ownerName} is on screen`);
        else if (b.scope === "panel" && o.scope === "plugin") say(b, "warn", `Not on ${o.ownerName}, where ${o.chord} is ${o.label}`);
      }
    }
    return list.map((b) => ({ ...b, active: !!b.spec && !held.has(b.id), issues: issues.get(b.id) }));
  };

  const list = () => all().map(({ run, ...b }) => b);

  // The scope's own first, so it wins a chord it shares with the panel.
  const live = (scopeId) => all()
    .filter((b) => b.active && (b.scope === "panel" || (b.scope === "plugin" && b.owner === scopeId)))
    .sort((a, b) => (a.scope === "plugin" ? 0 : 1) - (b.scope === "plugin" ? 0 : 1))
    .map((b) => ({ id: b.id, spec: b.spec, chord: CHORD.parse(b.spec), label: b.label, run: b.run }));

  // Only the page every scope registers in sees what collides, so only it publishes (publish()).
  const globals = () => {
    const said = all().filter((b) => b.scope === "global");
    const specs = (list) => Object.fromEntries(list.map((b) => [b.id, b.active ? b.spec : null]));
    return { host: specs(said.filter((b) => b.owner === "host")), page: specs(said.filter((b) => b.owner !== "host")) };
  };
  let publishing = false;
  const tellGlobals = () => { if (publishing) PROTOCOL.globals.send(globals()); };
  const announce = () => {
    tellGlobals();
    for (const fn of listeners) { try { fn(); } catch (e) { console.warn("[deckit] keymap listener threw", e); } }
  };

  const save = (next) => {
    overrides = next;
    PROTOCOL.setOverrides.ask({ overrides })
      .catch((e) => console.warn("[deckit] keymap was not saved", e));
    announce();
  };

  const isField = (el) => !!el && el.matches?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])");

  let connected = false;
  const connect = ({ floating, escape = null } = {}) => {
    if (connected) throw new Error("[deckit] a page connects to the keymap once");
    connected = true;
    let live = [];

    floating.onChange((owned) => PROTOCOL.floating.send({ on: !!owned }));

    // By id, not index: the list may be rebuilt between main matching and this arriving.
    PROTOCOL.key.hear(({ id }) => {
      const entry = live.find((k) => k.id === id) || all().find((b) => b.id === id && b.scope === "global" && b.run);
      if (!entry) return;
      try { entry.run(); } catch (e) { console.warn("[deckit] key handler threw", id, e); }
    });

    /* Main took this Escape, so the field never saw it: it is replayed as a keydown. A field that
       handles it calls preventDefault and keeps the caret; one that does not is blurred, as a
       browser would, so the next Escape reaches the page. */
    PROTOCOL.escape.hear(({ last }) => {
      const top = floating.top();
      if (top) { top.close(); return; }
      const field = document.activeElement;
      if (isField(field)) {
        const used = !field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
        if (!used && document.activeElement === field) field.blur();
        return;
      }
      if (last) escape?.();
    });

    // Deferred: during focusout the field losing focus is still the active element.
    let typing = false;
    const tellTyping = () => setTimeout(() => {
      const now = isField(document.activeElement);
      if (now === typing) return;
      typing = now;
      PROTOCOL.typing.send({ on: now });
    }, 0);
    document.addEventListener("focusin", tellTyping);
    document.addEventListener("focusout", tellTyping);

    return {
      answer(entries) {
        live = [...(entries || [])];
        PROTOCOL.chords.send({ chords: live.map((k) => ({ id: k.id, ...k.chord })) });
      },
    };
  };

  return {
    register,
    arrange,
    list,
    live,
    connect,
    publish() { publishing = true; tellGlobals(); },
    chord: (id) => all().find((b) => b.id === id && b.active)?.chord || "",
    set(id, spec) {
      const b = all().find((x) => x.id === id);
      if (!b) throw new Error("no such shortcut: " + id);
      const next = { ...overrides };
      const want = spec ? CHORD.normal(spec) : "";
      if (spec && !want) throw new Error("not a chord: " + spec);
      // Deleted and re-added so the saved map keeps the order changes were made in, which all() relies on.
      delete next[id];
      if (want !== b.key) next[id] = want;
      save(next);
    },
    reset(id) {
      if (!has(id)) return;
      const next = { ...overrides };
      delete next[id];
      save(next);
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    record(onKey) {
      let done = false;
      let stopHearing = () => {};
      const finish = () => {
        if (done) return;
        done = true;
        stopHearing();
        window.removeEventListener("keydown", local, true);
        PROTOCOL.record.send({ on: false });
      };
      const hear = (input) => {
        if (done) return;
        if (input.cancel || CHORD.cancels(input)) {
          finish();
          return onKey({ cancel: true });
        }
        if (CHORD.clears(input)) {
          finish();
          return onKey({ clear: true });
        }
        const got = CHORD.record(input);
        if (got.pending) return;
        // Main is still recording, so the next keystroke is still ours.
        if (got.error) return onKey(got);
        finish();
        onKey(got);
      };
      // For a keystroke main did not take; one main takes never reaches the page, so no double answer.
      const local = (e) => {
        e.preventDefault();
        e.stopPropagation();
        hear(CHORD.fromEvent(e));
      };
      stopHearing = PROTOCOL.recorded.hear(hear);
      window.addEventListener("keydown", local, true);
      PROTOCOL.record.send({ on: true });
      return finish;
    },
  };
});
