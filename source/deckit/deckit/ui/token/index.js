DeckitModule.define("deckit/ui/token", {
  uses: [],
  provides: [
    "FALLBACK_THEME", "FOCUS_RING", "ACCENT", "TONE", "WASH", "LIFT", "MOTION", "Z",
    "reducedMotion", "icon", "toRGB", "isDark", "blend", "alpha", "grabPointer", "scrollFade",
    "selectable", "aimOnMove", "pressable", "layers", "raise", "play",
  ],
}, () => {
  // Worn until the place's colours are measured; a theme push replaces them.
  const FALLBACK_THEME = Object.freeze({
    sidebarBg: "rgb(16, 18, 20)", sidebarColor: "#fff",
    border: "1px solid rgba(121,124,129,.3)",
    contentBg: "#1a1d21", contentColor: "#d1d2d3",
    font: '"Lato", -apple-system, system-ui, sans-serif',
  });

  const FOCUS_RING = "rgba(124,160,255,.7)";

  const ACCENT = "#4b8bf4";

  const toRGB = (color) => {
    const c = (color || "").trim();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
    if (hex) {
      const full = hex[1].length === 3 ? hex[1].replace(/./g, (ch) => ch + ch) : hex[1];
      return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    }
    const m = /^rgba?\(([^)]+)\)$/.exec(c);
    return m ? m[1].split(",").slice(0, 3).map((v) => parseFloat(v)) : null;
  };
  const isDark = (color) => {
    const c = toRGB(color) || [26, 29, 33];
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) < 140;
  };
  const blend = (fg, bg, t) => {
    const a = toRGB(fg), b = toRGB(bg);
    if (!a || !b) return fg;
    return `rgb(${a.map((v, i) => Math.round(b[i] + (v - b[i]) * t)).join(", ")})`;
  };
  const alpha = (color, a) => {
    const c = toRGB(color);
    return c ? `rgba(${c.join(", ")}, ${a})` : color;
  };

  const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const MOTION = Object.freeze({
    get fast() { return reducedMotion() ? "0ms" : "110ms"; },
    get base() { return reducedMotion() ? "0ms" : "170ms"; },
    get slow() { return reducedMotion() ? "0ms" : "260ms"; },
    ease: "cubic-bezier(.2,.7,.3,1)",
  });

  // Where a panel or a modal arrives from and leaves to.
  const LIFT = "translateY(6px) scale(.99)";

  // The panel clears the app's own furniture (its sidebar resizers sit at 1000).
  const Z = Object.freeze({ scrim: 1100, panel: 1101, popover: 1150, modal: 1200 });

  /* What floats above the page and answers Escape, bottom first: a layer's place is also its height.
     A press outside the top layer's `contains` closes it, and the next, until one holds the press;
     a layer with no `contains` holds every press. On pointerdown, so a control that cancels the
     mouse events after it (a resize handle) still closes what is open. */
  const LAYERS = [];
  let onLayers = () => {};
  const layersChanged = () => { try { onLayers(LAYERS.length > 0); } catch {} };
  window.addEventListener("pointerdown", (e) => {
    for (let top = LAYERS[LAYERS.length - 1]; top && typeof top.contains === "function" && !top.contains(e.target); top = LAYERS[LAYERS.length - 1]) {
      const was = LAYERS.length;
      top.close();
      // A close that did not take its layer out (it was already on its way) must not stall the walk.
      if (LAYERS.length === was) { LAYERS.pop(); layersChanged(); }
    }
  }, true);
  const raise = (layer) => {
    LAYERS.push(layer);
    layersChanged();
    return {
      z: Z.modal + LAYERS.length - 1,
      isTop: () => LAYERS[LAYERS.length - 1] === layer,
      drop: () => {
        const at = LAYERS.indexOf(layer);
        if (at >= 0) { LAYERS.splice(at, 1); layersChanged(); }
      },
    };
  };
  const layers = {
    top: () => LAYERS[LAYERS.length - 1] || null,
    get count() { return LAYERS.length; },
    // Main takes Escape for this page while anything floats.
    onChange: (fn) => { onLayers = fn; },
  };

  /* The start is read back before the end is written, or both land in one style pass and
     nothing transitions; a frame in between is not enough. */
  const play = (el, start, end) => {
    Object.assign(el.style, start);
    void el.offsetHeight;
    Object.assign(el.style, end);
  };

  const TONE = Object.freeze({ ok: "#2eb67d", warn: "#ecb22e", alert: "#e01e5a" });

  const WASH = Object.freeze({ hover: "rgba(128,128,128,.14)", cursor: "rgba(128,128,128,.22)" });

  /* A veil over everything for a drag's length: over a cross-origin iframe the pointer events
     would go to that document and the drag would die with the button still down. */
  const grabPointer = (cursor) => {
    const veil = document.createElement("div");
    Object.assign(veil.style, {
      position: "fixed", top: "0", right: "0", bottom: "0", left: "0",
      zIndex: String(Z.modal), cursor, background: "transparent",
    });
    // Marked, so a drag asking what is under the pointer can look past it.
    veil.dataset.deckitVeil = "";
    document.body.appendChild(veil);
    return () => veil.remove();
  };

  /* aimOnMove: the browser reports a pointer that stayed put as a move to the same place when a
     row appears under it, so a move counts only when the position changed. Tracked over the whole
     page, so a list hidden and shown again does not compare against where the pointer was then. */
  let pointerBefore = null, pointerNow = null;
  window.addEventListener("mousemove", (e) => {
    pointerBefore = pointerNow;
    pointerNow = e.screenX + "," + e.screenY;
  }, true);
  // Forgotten when the page stops seeing the pointer: the first move afterwards is a position, not a move.
  const forgetPointer = () => { pointerBefore = pointerNow = null; };
  document.addEventListener("visibilitychange", forgetPointer);
  // On window, because this runs before the page has a document element.
  window.addEventListener("mouseout", (e) => { if (!e.relatedTarget) forgetPointer(); });
  window.addEventListener("blur", forgetPointer);
  const aimOnMove = (list, onAim) => {
    list.addEventListener("mousemove", (e) => {
      if (pointerBefore !== null && pointerBefore !== pointerNow) onAim(e);
    });
  };

  /* A mask on the scrolling box rather than an overlay: an overlay would have to be painted in the
     colour behind the list, and on the glass panel that is not one colour. */
  const scrollFade = (el, size = 18) => {
    let queued = false;
    const paint = () => {
      queued = false;
      const top = Math.max(0, Math.min(size, el.scrollTop));
      const bottom = Math.max(0, Math.min(size, el.scrollHeight - el.clientHeight - el.scrollTop));
      el.style.maskImage = top || bottom
        ? `linear-gradient(to bottom, transparent 0, #000 ${top}px, #000 calc(100% - ${bottom}px), transparent 100%)`
        : "none";
    };
    const soon = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
    el.addEventListener("scroll", soon, { passive: true });
    new ResizeObserver(soon).observe(el);
    new MutationObserver(soon).observe(el, { childList: true, subtree: true });
    paint();
    return el;
  };

  const selectable = (el) => { el.style.userSelect = "text"; return el; };

  /* Lucide (ISC, https://lucide.dev), only the paths used, inlined: no network at runtime, and
     the renderer is CSP-bound. */
  const GLYPH = {
    plus: `<path d="M5 12h14"/><path d="M12 5v14"/>`,
    minus: `<path d="M5 12h14"/>`,
    pencil: `<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>`,
    x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
    chevronDown: `<path d="m6 9 6 6 6-6"/>`,
    chevronUp: `<path d="m18 15-6-6-6 6"/>`,
    filter: `<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>`,
    replace: `<path d="M14 4a1 1 0 0 1 1-1"/><path d="M15 10a1 1 0 0 1-1-1"/><path d="M21 4a1 1 0 0 0-1-1"/><path d="M21 9a1 1 0 0 1-1 1"/><path d="m3 7 3 3 3-3"/><path d="M6 10V5a2 2 0 0 1 2-2h2"/><rect x="3" y="14" width="7" height="7" rx="1"/>`,
    replaceAll: `<path d="M14 14a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1"/><path d="M14 4a1 1 0 0 1 1-1"/><path d="M15 10a1 1 0 0 1-1-1"/><path d="M19 14a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1"/><path d="M21 4a1 1 0 0 0-1-1"/><path d="M21 9a1 1 0 0 1-1 1"/><path d="m3 7 3 3 3-3"/><path d="M6 10V5a2 2 0 0 1 2-2h2"/><rect x="3" y="14" width="7" height="7" rx="1"/>`,
    chevronLeft: `<path d="m15 18-6-6 6-6"/>`,
    chevronRight: `<path d="m9 18 6-6-6-6"/>`,
    folder: `<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`,
    folderOpen: `<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>`,
    folderPlus: `<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`,
    filePlus: `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 18v-6"/>`,
    trash: `<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>`,
    home: `<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
    download: `<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>`,
    grid: `<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>`,
    eye: `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>`,
    eyeOff: `<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>`,
    arrowUp: `<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>`,
    ellipsis: `<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>`,
    reload: `<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>`,
    star: `<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>`,
    bookmark: `<path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"/>`,
    window: `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/>`,
    externalWindow: `<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`,
    dockWindow: `<path d="M9 21H3v-6"/><path d="M14 10 3 21"/><path d="M6 11V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-6"/>`,
    panelLeft: `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>`,
    puzzle: `<path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/>`,
    calendar: `<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>`,
    calendarDays: `<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/><path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/>`,
    clock: `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`,
    info: `<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>`,
    keyboard: `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/>`,
    layers: `<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>`,
    columns: `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>`,
    list: `<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>`,
    search: `<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>`,
    server: `<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>`,
    play: `<path d="m6 3 14 9-14 9z"/>`,
    square: `<rect x="3" y="3" width="18" height="18" rx="2"/>`,
    power: `<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>`,
    globe: `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`,
    gear: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
    sliders: `<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>`,
    link: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
    mic: `<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>`,
    video: `<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>`,
    monitor: `<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>`,
    mapPin: `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`,
    door: `<path d="M11 20H2"/><path d="M11 4.562v16.157a1 1 0 0 0 1.242.97L19 20V5.562a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 11 4.561z"/><path d="M11 4H8a2 2 0 0 0-2 2v14"/><path d="M14 12h.01"/><path d="M22 20h-3"/>`,
    shieldCheck: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>`,
    bell: `<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>`,
    bellOff: `<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742"/><path d="m2 2 20 20"/><path d="M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05"/>`,
    volume: `<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>`,
    volumeOff: `<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>`,
    messageSquare: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
    copy: `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
    check: `<path d="M20 6 9 17l-5-5"/>`,
    fileText: `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
    wrapText: `<path d="m16 16-3 3 3 3"/><path d="M3 12h14.5a1 1 0 0 1 0 7H13"/><path d="M3 19h6"/><path d="M3 5h18"/>`,
    grip: `<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>`,
    anvil: `<path d="M7 10H6a4 4 0 0 1-4-4 1 1 0 0 1 1-1h4"/><path d="M7 5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1 7 7 0 0 1-7 7H8a1 1 0 0 1-1-1z"/><path d="M9 12v5"/><path d="M15 12v5"/><path d="M5 20a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3 1 1 0 0 1-1 1H6a1 1 0 0 1-1-1"/>`,
    brain: `<path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/>`,
    layoutDashboard: `<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>`,
    rocket: `<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"/><path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"/>`,
    folders: `<path d="M20 5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2.5a1.5 1.5 0 0 1 1.2.6l.6.8a1.5 1.5 0 0 0 1.2.6z"/><path d="M3 8.268a2 2 0 0 0-1 1.738V19a2 2 0 0 0 2 2h11a2 2 0 0 0 1.732-1"/>`,
    tableOfContents: `<path d="M16 5H3"/><path d="M16 12H3"/><path d="M16 19H3"/><path d="M21 5h.01"/><path d="M21 12h.01"/><path d="M21 19h.01"/>`,
  };

  const icon = (name, size = 15, { fill = "none", color = "currentColor" } = {}) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" width="${size}" height="${size}" style="display:block"` +
    ` fill="${fill}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    (GLYPH[name] || "") + `</svg>`;

  const pressable = (b, hover = "rgba(128,128,128,.18)", press = "rgba(128,128,128,.34)") => {
    // `rest`: the background with no pointer on it (setRest).
    let over = false, down = false, rest = "transparent";
    const paint = () => { b.style.background = b.disabled ? "transparent" : down ? press : over ? hover : rest; };
    b.addEventListener("mouseenter", () => { over = true; paint(); });
    b.addEventListener("mouseleave", () => { over = down = false; paint(); });
    b.addEventListener("mousedown", () => { down = true; paint(); });
    b.addEventListener("mouseup", () => { down = false; paint(); });
    b.addEventListener("focus", () => {
      if (b.matches(":focus-visible")) b.style.boxShadow = "0 0 0 2px " + FOCUS_RING;
    });
    b.addEventListener("blur", () => { b.style.boxShadow = "none"; });
    b.repaint = paint;
    b.setRest = (color) => { rest = color || "transparent"; paint(); };
    return b;
  };

  return {
    FALLBACK_THEME, FOCUS_RING, ACCENT, TONE, WASH, LIFT, MOTION, Z,
    reducedMotion, icon, toRGB, isDark, blend, alpha, grabPointer, scrollFade, selectable, aimOnMove, pressable,
    layers, raise, play,
  };
});
