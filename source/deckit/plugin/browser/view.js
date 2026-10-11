Deckit.register({
  icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
  homepage: "https://www.google.com/",
  keywords: ["브라우저", "웹", "인터넷", "browser", "web"],

  make({ theme, ui, store, data, storage, web, host, util }) {
    const HOME = this.homepage;
    const { safeHost, canon } = util;
    const placeOf = (url) => {
      if (/^file:/i.test(String(url || ""))) { try { return decodeURIComponent(new URL(url).pathname.split("/").pop() || "/"); } catch { return url; } }
      return safeHost(url);
    };
    const content = document.createElement("div");
    Object.assign(content.style, { position: "relative", width: "100%", height: "100%", overflow: "hidden" });

    const sidebar = document.createElement("div");
    Object.assign(sidebar.style, { display: "flex", flexDirection: "column", minHeight: "0", flex: "1 1 auto" });

    const tabs = [];
    let activeId = null, seq = 0;

    const persist = () => {
      data.set("session", {
        tabs: tabs.map((t) => ({ url: t.url, title: t.title, icon: t.icon })),
        active: Math.max(0, tabs.findIndex((t) => t.id === activeId)),
        closed,
      });
    };
    const active = () => tabs.find((t) => t.id === activeId);

    /* Bookmarks, certificates and the session are in `data`: the same in every window, and kept apart
       from the app's profile. Fold state is view state, in `store`. A bookmark is identified by its
       canonical address, as a tab's address is, or the star stays dark on its own page and adds it twice. */
    const bookmarks = {
      // Canonical on read too, for entries stored as typed.
      all: () => data.get("bookmarks", []).map((b) => ({ ...b, url: canon(b.url) })),
      has: (url) => bookmarks.all().some((b) => b.url === canon(url)),
      toggle(raw, label, icon) {
        const url = canon(raw);
        const list = bookmarks.all();
        const at = list.findIndex((b) => b.url === url);
        if (at >= 0) list.splice(at, 1); else list.push({ url, label: label || url, icon: icon || "" });
        data.set("bookmarks", list); renderMarks();
      },
      remove(url) { data.set("bookmarks", bookmarks.all().filter((b) => b.url !== url)); renderMarks(); },
      move(from, to) {
        const list = bookmarks.all();
        const [m] = list.splice(from, 1);
        if (!m) return;
        list.splice(to, 0, m);
        data.set("bookmarks", list); renderMarks();
      },
      // False when the new address is another bookmark's: the star cannot tell two entries for one page apart.
      edit(url, patch) {
        const list = bookmarks.all();
        const m = list.find((b) => b.url === url);
        if (!m) return false;
        const next = { ...patch, ...(patch.url ? { url: canon(patch.url) } : {}) };
        if (next.url && next.url !== m.url && list.some((b) => b.url === next.url)) return false;
        // A new address makes the stored icon wrong; iconOf's conventional path stands in until then.
        if (next.url && next.url !== m.url) m.icon = "";
        Object.assign(m, next);
        data.set("bookmarks", list); renderMarks();
        return true;
      },
      add(raw, label) {
        const url = canon(raw);
        const list = bookmarks.all();
        if (list.some((b) => b.url === url)) return;
        list.push({ url, label: label || placeOf(url) || url, icon: "" });
        data.set("bookmarks", list); renderMarks();
      },
    };

    // Files get a session of their own (system.files), so a file page never holds the web's cookies.
    const webSession = storage.web("web");
    const filesSession = storage.web("files");

    /* Main refuses an unverifiable certificate by default and forgets every decision on exit, so
       the accepted ones are kept here and replayed at startup. Kept with the fingerprint, so a
       swapped certificate asks again. */
    const certs = {
      all: () => data.get("trusted", []),
      add(host_, fingerprint) {
        const list = certs.all().filter((c) => c.host !== host_);
        list.push({ host: host_, fingerprint });
        data.set("trusted", list);
        return { host: host_, fingerprint };
      },
    };
    webSession.trust(certs.all());
    const certAsked = new Set();   // a refused load reports on every retry; ask once per attempt

    // Grants are kept and replayed the same way. A refusal is not kept: it lasts as long as the tab.
    const grants = {
      all: () => data.get("permissions", []),
      add(entries) {
        const key = (g) => g.origin + "|" + g.permission;
        const have = new Set(grants.all().map(key));
        data.set("permissions", [...grants.all(), ...entries.filter((g) => !have.has(key(g)))]);
      },
      of: (origin) => grants.all().filter((g) => g.origin === origin),
      remove(entries) {
        const gone = new Set(entries.map((g) => g.origin + "|" + g.permission));
        data.set("permissions", grants.all().filter((g) => !gone.has(g.origin + "|" + g.permission)));
      },
    };
    const originOf = (url) => { try { return new URL(url).origin; } catch { return ""; } };
    const sayList = (words) => words.length > 1
      ? words.slice(0, -1).join(", ") + " and " + words[words.length - 1] : words[0] || "";
    webSession.allow(grants.all());
    const PERMISSION_WORDS = { microphone: "your microphone", camera: "your camera", notifications: "notifications" };
    const PERMISSION_LABELS = { microphone: "Microphone", camera: "Camera", notifications: "Notifications" };
    // "open:<scheme>": opening the app for that kind of address, asked per app.
    const opensApp = (p) => p.startsWith("open:");
    const labelOf = (p) => (opensApp(p) ? `Open \u201c${p.slice(5)}\u201d links in their app` : PERMISSION_LABELS[p]);

    const CHEVRON_L = ui.icon("chevronLeft", 17);
    const CHEVRON_R = ui.icon("chevronRight", 17);
    const RELOAD = ui.icon("reload", 15);
    const STAR = (on) => ui.icon("star", 16, { fill: on ? "currentColor" : "none" });

    // A translucent fill with a backdrop blur, not element opacity, which would let the page's text
    // show through.
    const GLASS = { rest: 0.72, open: 0.94 };
    const GLASS_BLUR = "blur(12px) saturate(1.4)";

    const EASE = `${ui.motion.base} ${ui.motion.ease}`;
    const island = document.createElement("div");
    const ISLAND_TRANSITION =
      `top ${EASE}, bottom ${EASE}, transform ${EASE},`
      + ` box-shadow ${EASE}, background-color ${EASE}`;
    Object.assign(island.style, {
      position: "absolute", zIndex: "2",
      display: "flex", alignItems: "center", boxSizing: "border-box",
      // 2px a side puts every 30px control 3px from the edge of the 36px capsule with its 1px border.
      height: "36px", padding: "0 2px",
      width: "max-content", maxWidth: "calc(100% - 20px)",
      color: theme.contentColor, font: "13px " + theme.font,
      borderRadius: "999px", border: theme.border,
      background: ui.alpha(theme.contentBg, GLASS.rest),
      backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
      boxShadow: "0 2px 10px rgba(0,0,0,.26)",
      overflow: "hidden", whiteSpace: "nowrap",
      cursor: "grab",
      transition: ISLAND_TRANSITION,
    });
    island.addEventListener("dragstart", (e) => e.preventDefault());

    // --deckit-top-inset steps the top corners out from under the window's bar while it is down.
    const CORNERS = ["tl", "tr", "bl", "br"];
    const CORNER_KEY = "island-corner";
    const EDGE = { side: 10, top: 8, bottom: 10 };
    const place = (c) => {
      const top = c[0] === "t", left = c[1] === "l";
      Object.assign(island.style, {
        top: top ? `calc(${EDGE.top}px + var(--deckit-top-inset, 0px))` : "auto",
        bottom: top ? "auto" : EDGE.bottom + "px",
        left: left ? EDGE.side + "px" : "auto",
        right: left ? "auto" : EDGE.side + "px",
      });
    };

    let corner = store.get(CORNER_KEY, "tl");
    if (!CORNERS.includes(corner)) corner = "tl";

    const goBack = () => active()?.page.back();
    const goForward = () => active()?.page.forward();
    const back = ui.iconBtn(CHEVRON_L, "Back", goBack);
    const fwd = ui.iconBtn(CHEVRON_R, "Forward", goForward);
    const reloadActive = () => {
      const t = active(); if (!t) return;
      certAsked.clear();                                 // a deliberate retry asks again
      t.page.reload();
    };
    const reload = ui.iconBtn(RELOAD, "Reload", reloadActive);
    const sitePermissions = () => {
      const t = active();
      const origin = originOf(t?.url);
      if (!/^https?:/.test(origin)) return;
      const had = new Set(grants.of(origin).map((g) => g.permission));
      const kinds = [...Object.keys(PERMISSION_WORDS), ...[...had].filter(opensApp)];
      ui.dialog({
        title: `Permissions for ${safeHost(origin) || origin}`,
        message: "Off, and the site asks the next time it wants it.",
        fields: kinds.map((k) => ({ key: k, type: "switch", label: labelOf(k), value: had.has(k) })),
        onConfirm: async (values) => {
          const added = kinds.filter((k) => values[k] && !had.has(k)).map((permission) => ({ origin, permission }));
          const removed = kinds.filter((k) => !values[k] && had.has(k)).map((permission) => ({ origin, permission }));
          if (added.length) {
            grants.add(added);
            for (const x of tabs) for (const g of added) x.refused.delete(g.origin + "|" + g.permission);
            await webSession.allow(added);
          }
          if (removed.length) {
            grants.remove(removed);
            await webSession.revoke(removed);
            /* A page keeps a stream it already has and still believes it granted, so revoking reloads
               its tabs. An app's permission is asked at each opening and needs no reload. */
            if (removed.some((g) => !opensApp(g.permission))) for (const x of tabs) if (originOf(x.url) === origin) x.page.reload();
          }
        },
      });
    };
    const site = ui.iconBtn(ui.icon("gear", 15), "Site permissions", sitePermissions);
    const star = ui.iconBtn(STAR(false), "Bookmark", () => {
      const t = active(); if (!t) return;
      bookmarks.toggle(t.url, t.title || placeOf(t.url), t.icon);
      if (parseFloat(ui.motion.fast)) {
        star.animate([{ transform: "scale(1)" }, { transform: "scale(1.28)" }, { transform: "scale(1)" }],
          { duration: 220, easing: ui.motion.ease });
      }
    });

    // The wings animate their own width and the capsule, sized by its contents, follows: the
    // island's own width has no value to animate to.
    for (const b of [back, fwd, reload, site, star]) b.style.borderRadius = "999px";
    const NAV_W = 90;      // three 30px buttons
    const STAR_W = 30;
    const nav = document.createElement("div");
    Object.assign(nav.style, {
      display: "flex", alignItems: "center", flex: "0 0 auto",
      width: "0px", opacity: "0", overflow: "hidden",
      transition: `width ${ui.motion.base} ${ui.motion.ease}, opacity ${ui.motion.base} ${ui.motion.ease}`,
    });
    nav.append(back, fwd, reload);
    for (const b of [site, star]) {
      Object.assign(b.style, {
        width: "0px", opacity: "0", overflow: "hidden",
        transition: `width ${ui.motion.base} ${ui.motion.ease}, opacity ${ui.motion.base} ${ui.motion.ease},`
          + ` background-color ${ui.motion.fast} ${ui.motion.ease}`,
      });
    }

    const addr = document.createElement("button");
    addr.type = "button";
    Object.assign(addr.style, {
      flex: "0 1 auto", minWidth: "0", display: "flex", alignItems: "center",
      height: "30px", padding: "0 10px", borderRadius: "999px", border: "0",
      background: "transparent", color: theme.contentColor, cursor: "text",
      font: "13px " + theme.font, textAlign: "left", overflow: "hidden",
      transition: `background-color ${ui.motion.fast} ${ui.motion.ease}`,
    });
    ui.pressable(addr);
    const iconBox = document.createElement("span");
    Object.assign(iconBox.style, { flex: "0 0 auto", display: "flex", alignItems: "center", marginRight: "6px" });
    const hostEl = document.createElement("span");
    Object.assign(hostEl.style, { whiteSpace: "nowrap", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "260px" });
    const titleEl = document.createElement("span");
    Object.assign(titleEl.style, {
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: "0",
      /* Padding, not a flex gap: a gap is drawn even beside an item with no width. It goes to 0
         with the width, since a box cannot be narrower than its padding. */
      maxWidth: "0px", paddingLeft: "0px", boxSizing: "border-box",
      transition: `max-width ${ui.motion.base} ${ui.motion.ease}, opacity ${ui.motion.base} ${ui.motion.ease},`
        + ` padding-left ${ui.motion.base} ${ui.motion.ease}`,
    });
    addr.append(iconBox, hostEl, titleEl);

    const input = document.createElement("input");
    input.spellcheck = false;
    Object.assign(input.style, {
      display: "none", flex: "0 0 auto", width: "min(46vw, 420px)", minWidth: "0", height: "28px",
      margin: "0 2px", padding: "0 10px", borderRadius: "999px", border: "0",
      background: "rgba(128,128,128,.14)", color: theme.contentColor,
      font: "13px " + theme.font, outline: "none",
    });

    let open = false;
    let pinned = false;

    // Opened by a click, not on hover: a control that unfurls on hover moves out from under the pointer.
    const expand = () => {
      island.style.background = ui.alpha(theme.contentBg, GLASS.open);
      island.style.boxShadow = "0 6px 18px rgba(0,0,0,.34)";
      nav.style.width = NAV_W + "px"; nav.style.opacity = "1";
      star.style.width = STAR_W + "px"; star.style.opacity = "1";
      paintSite();
      titleEl.style.maxWidth = "360px"; titleEl.style.opacity = ".55"; titleEl.style.paddingLeft = "6px";
    };
    const collapse = () => {
      island.style.background = ui.alpha(theme.contentBg, GLASS.rest);
      island.style.boxShadow = "0 2px 10px rgba(0,0,0,.26)";
      nav.style.width = "0px"; nav.style.opacity = "0";
      star.style.width = "0px"; star.style.opacity = "0";
      paintSite();
      titleEl.style.maxWidth = "0px"; titleEl.style.opacity = "0"; titleEl.style.paddingLeft = "0px";
    };
    const paintSite = () => {
      const on = open && /^https?:/.test(originOf(active()?.url));
      site.style.width = on ? STAR_W + "px" : "0px";
      site.style.opacity = on ? "1" : "0";
    };
    const setOpen = (on) => {
      if (open === on) return;
      if (!on && pinned) return;                         // the caret is in the address; it stays open
      open = on;
      if (on) expand(); else collapse();
    };

    // Any press elsewhere closes it, not a mouseleave. A press on the page arrives as didFocus (listen).
    document.addEventListener("pointerdown", (e) => {
      if (!island.contains(e.target) && !pinned) setOpen(false);
    }, true);

    const openEditor = () => {
      const t = active(); if (!t) return;
      addr.style.display = "none"; input.style.display = "block";
      input.value = t.url;
      pinned = true; setOpen(true); input.focus(); input.select();
    };
    const closeEditor = () => {
      input.style.display = "none"; addr.style.display = "flex";
      pinned = false;
    };
    // A pointer press is answered by the carry handler below, which knows whether the pointer travelled;
    // this click is what keyboard activation reaches.
    const pressAddress = () => (open ? openEditor() : setOpen(true));
    addr.addEventListener("click", () => { if (!answered()) pressAddress(); });
    input.addEventListener("blur", closeEditor);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") return closeEditor();
      if (e.key !== "Enter") return;
      const t = active(), raw = input.value.trim();
      if (t && raw) navigate(t, parseAddress(raw) || searchFor(raw));
      closeEditor();
    });
    island.append(nav, addr, input, site, star);

    /* Past DRAG_THRESHOLD a press is a carry and its click is swallowed. Letting go sets the new
       corner first and then animates from where it was, so an animation that never plays (the
       window in the background) still leaves it where it belongs. */
    const DRAG_THRESHOLD = 4;
    // The click the browser sends after a settled gesture is already answered.
    let settledAt = 0;
    const answered = () => Date.now() - settledAt < 400;

    island.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (input.contains(e.target) || nav.contains(e.target) || site.contains(e.target) || star.contains(e.target)) return;
      // No preventDefault: the press must take focus back from the page, or a carry begun while the
      // page had the keyboard never finishes.
      // Captured at once: a quick flick leaves the 36px capsule on the first move, which would go to the page.
      island.setPointerCapture(e.pointerId);
      // The veil goes up at once too: the browser process routes the next move before capture takes effect.
      const release = ui.grabPointer("grabbing");

      const box = content.getBoundingClientRect();
      const ox = e.clientX, oy = e.clientY;
      let moved = false;
      let done = false;

      /* The one way out, however the gesture ends: the veil covers the whole panel, so a gesture
         that never finishes swallows every later press. */
      const finish = (ev) => {
        if (done) return;
        done = true;
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", finish, true);
        window.removeEventListener("pointercancel", finish, true);
        window.removeEventListener("blur", finish);
        window.removeEventListener("pointerdown", again, true);
        island.removeEventListener("lostpointercapture", finish);
        try { island.releasePointerCapture(e.pointerId); } catch {}
        release();
        settledAt = Date.now();
        // It never travelled: a press, answered here because its click is swallowed.
        if (!moved) { if (ev && ev.type === "pointerup") pressAddress(); return; }
        island.style.cursor = "grab";

        const from = island.getBoundingClientRect();
        corner = (from.top + from.height / 2 < box.top + box.height / 2 ? "t" : "b")
               + (from.left + from.width / 2 < box.left + box.width / 2 ? "l" : "r");
        store.set(CORNER_KEY, corner);

        island.style.transform = "";
        place(corner);
        // Measured with the transition still off, so the corner change is settled here and
        // restoring the transition does not also animate `top` behind the animation below.
        const to = island.getBoundingClientRect();
        island.style.transition = ISLAND_TRANSITION;
        const dx = from.left - to.left, dy = from.top - to.top;
        const ms = parseFloat(ui.motion.base) || 0;
        if (ms && (dx || dy)) {
          island.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
            { duration: ms, easing: ui.motion.ease },
          );
        }
      };

      const onMove = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        if (!(ev.buttons & 1)) return finish(ev);
        const dx = ev.clientX - ox, dy = ev.clientY - oy;
        if (!moved) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          moved = true;
          island.style.cursor = "grabbing";
          island.style.transition = "none";
        }
        island.style.transform = `translate(${dx}px, ${dy}px)`;
      };
      const again = (ev) => { if (ev !== e) finish(null); };

      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerdown", again, true);
      window.addEventListener("pointerup", finish, true);
      window.addEventListener("pointercancel", finish, true);
      window.addEventListener("blur", finish);
      island.addEventListener("lostpointercapture", finish);
    });

    island.addEventListener("click", (e) => { if (answered()) e.stopPropagation(); }, true);

    place(corner);

    // One rule for every caller. A file path may hold spaces, so it is read before whitespace means a search.
    const parseAddress = (raw) => {
      const text = String(raw || "").trim();
      if (/^file:\/\//i.test(text)) { try { return new URL(text).href; } catch { return null; } }
      if (/^\/[^/]/.test(text)) { try { return new URL("file://" + text.split("/").map(encodeURIComponent).join("/")).href; } catch { return null; } }
      if (!text || /\s/.test(text)) return null;
      const typed = /^https?:\/\//i.test(text) ? text
        : /^(localhost|[\w-]+(\.[\w-]+)+|\d{1,3}(\.\d{1,3}){3})(:\d{1,5})?([/?#].*)?$/i.test(text) ? "https://" + text
        : null;
      if (!typed) return null;
      try { return new URL(typed).href; } catch { return null; }
    };
    const searchFor = (raw) => "https://www.google.com/search?q=" + encodeURIComponent(raw);
    const notAnAddress = (raw) => ui.dialog({ title: "Not a web address", message: raw, confirmLabel: "OK", cancelLabel: "Close" });

    const syncBar = () => {
      const t = active(); if (!t) return;
      back.setEnabled(t.canGoBack);
      fwd.setEnabled(t.canGoForward);
      hostEl.textContent = placeOf(t.url);
      iconBox.textContent = "";
      iconBox.appendChild(t.loading ? ui.spinner(13) : favicon(iconOf(t)));
      titleEl.textContent = t.title || "";
      star.innerHTML = STAR(bookmarks.has(t.url));
      paintSite();
    };

    /* A tab crossing between file and web is given a new page in the other session: a web page's
       history has no file in it to go back to. */
    const isFile = (url) => /^file:/i.test(String(url || ""));
    const pageFor = (url) => web.page({ session: isFile(url) ? filesSession : webSession, url });
    const inFiles = (tab) => tab.page.session === filesSession;
    const navigate = (tab, raw) => {
      certAsked.clear();
      const url = canon(raw);
      if (isFile(url) === inFiles(tab)) { tab.page.load(url); return; }
      const old = tab.page;
      tab.page = pageFor(url);
      content.insertBefore(tab.page.element, old.element);
      releasePage(tab, old);
      Object.assign(tab, { url, title: "", icon: "", loading: true, canGoBack: false, canGoForward: false });
      listen(tab);
      showTabs();
      if (tab.id === activeId) syncBar();
      renderTabs(); persist();
    };
    const releasePage = (tab, page) => {
      for (const req of tab.held.splice(0)) req.answer(false);
      if (finding === tab) closeFind();
      page.close();
    };

    // Hidden, not display:none: a page element with nothing to draw into comes back blank or at the wrong size.
    const showTabs = () => { for (const t of tabs) t.page.element.style.visibility = t.id === activeId ? "visible" : "hidden"; };
    const setActiveTab = (id) => {
      if (id !== activeId) closeFind();
      activeId = id;
      showTabs();
      syncBar(); renderTabs(); persist();
      const now = active();
      if (shown && now?.held.length) askHeld(now);
    };

    // Main shows no interstitial for an unverifiable certificate, only a refusal: this dialog is it.
    const askCert = (tab, info) => {
      if (!info || !info.host || !info.fingerprint) return;
      const mark = info.host + "|" + info.fingerprint;
      if (certAsked.has(mark)) return;
      certAsked.add(mark);
      ui.dialog({
        title: "Certificate cannot be verified",
        message: `${info.host} is served with a certificate issued by "${info.issuer || "an unknown authority"}", `
          + `which this machine does not trust (${info.error}). Internal sites signed by a private CA look `
          + `exactly like this, and so does someone sitting in the middle of the connection.`,
        confirmLabel: "Trust and reload",
        destructive: true,
        onConfirm: async () => {
          const entry = certs.add(info.host, info.fingerprint);
          // Main reloads what was refused, which may be a window this tab opened rather than the tab.
          await webSession.trust([entry]);
          certAsked.delete(mark);
        },
      });
    };

    // Asked only while the Browser is on screen: a background tab holds its question until it is
    // shown in front.
    let shown = false;
    const askHeld = (tab) => {
      const held = tab.held.splice(0);
      for (const req of held) askPermission(tab, req);
    };
    const askPermission = (tab, req) => {
      if (!tabs.includes(tab)) return req.answer(false);
      const wanted = req.permissions.filter((p) => PERMISSION_WORDS[p] || opensApp(p));
      if (!wanted.length || wanted.some((p) => tab.refused.has(req.origin + "|" + p))) return req.answer(false);
      if (!shown) { tab.held.push(req); return; }
      if (tab.id !== activeId) setActiveTab(tab.id);
      if (wanted.some(opensApp)) return askOpen(tab, req, wanted);
      let allowed = false;
      ui.dialog({
        title: `${safeHost(req.origin) || req.origin} wants to use ${sayList(wanted.map((p) => PERMISSION_WORDS[p]))}`,
        message: "Allowed, it is remembered for this site. Blocked, it stays blocked until this tab is closed.",
        confirmLabel: "Allow",
        cancelLabel: "Block",
        // Kept, here and in main, before the page hears yes: what it does next asks main again.
        onConfirm: () => {
          allowed = true;
          const kept = wanted.map((permission) => ({ origin: req.origin, permission }));
          grants.add(kept);
          webSession.allow(kept).catch(() => {}).then(() => req.answer(true));
          paintSite();
        },
        // Runs before onConfirm, so the answer waits a turn to see whether it was a yes.
        onClose: () => queueMicrotask(() => {
          if (allowed) return;
          for (const p of wanted) tab.refused.add(req.origin + "|" + p);
          req.answer(false);
        }),
      });
    };

    const askOpen = (tab, req, wanted) => {
      const app = req.app || "an app", site = safeHost(req.origin) || req.origin;
      let opened = false;
      ui.dialog({
        title: `Open ${app}?`,
        message: `${site} wants to open ${app} on this Mac.`,
        fields: [{ key: "always", type: "switch", label: `Always allow ${site} to open ${app}`, value: false }],
        confirmLabel: `Open ${app}`,
        cancelLabel: "Cancel",
        onConfirm: ({ always }) => {
          opened = true;
          const kept = always ? wanted.map((permission) => ({ origin: req.origin, permission })) : [];
          if (kept.length) grants.add(kept);
          (kept.length ? webSession.allow(kept).catch(() => {}) : Promise.resolve()).then(() => req.answer(true));
          paintSite();
        },
        onClose: () => queueMicrotask(() => {
          if (opened) return;
          for (const p of wanted) tab.refused.add(req.origin + "|" + p);
          req.answer(false);
        }),
      });
    };

    const showNotification = (tab, n) => {
      host.notify({
        title: n.title || safeHost(tab.url),
        body: n.body ? n.body + " · " + safeHost(tab.url) : safeHost(tab.url),
        silent: n.silent,
        onClick: () => {
          if (!tabs.includes(tab)) return;
          host.show();
          setActiveTab(tab.id);
          n.click();
        },
      });
    };

    const newTab = (url = HOME, title = "", icon = "", background = false) => {
      const id = ++seq;
      const page = pageFor(url);
      page.element.style.visibility = "hidden";
      content.insertBefore(page.element, island);
      const tab = {
        id, page, url: canon(url), title, icon,
        loading: true, canGoBack: false, canGoForward: false, target: "",
        refused: new Set(),   // origin|permission blocked while this tab is open
        held: [],             // permission questions waiting for the browser to be on screen
        audible: false, muted: false, capture: { microphone: false, camera: false, screen: false },
      };
      tabs.push(tab);
      listen(tab);
      if (background) { renderTabs(); persist(); } else setActiveTab(id);
      return id;
    };
    const listen = (tab) => {
      const { page } = tab;
      const held = () => tab.page === page && tabs.includes(tab);
      page.delegate = {
        didChange: (s) => {
          if (tab.page !== page) return;
          if (s.url) tab.url = canon(s.url);
          tab.title = s.title || "";
          if (s.icon || !s.loading) tab.icon = s.icon || "";
          tab.loading = s.loading;
          tab.canGoBack = s.canGoBack; tab.canGoForward = s.canGoForward;
          tab.audible = !!s.audible; tab.muted = !!s.muted; tab.capture = s.capture || tab.capture;
          if (tab.id === activeId) syncBar();
          renderTabs(); persist();
        },
        didFocus: () => setOpen(false),
        didRefuseCertificate: (info) => askCert(tab, info),
        decidePermission: (request) => new Promise((answer) => askPermission(tab, { ...request, answer })),
        didReceiveNotification: (n) => showNotification(tab, n),
        didFind: (r) => { if (finding === tab && tab.page === page) showCount(r); },
        // A file page following a link to the web: reopened here in the web session.
        shouldLeave: (url) => {
          if (held()) navigate(tab, url);
          return false;
        },
        didRequestClose: () => { if (held()) dropTab(tab.id); },
      };
    };

    const dropTab = (id) => {
      const row = tabList.querySelector(`[data-tab-id="${id}"]`);
      if (!row) return closeTab(id);
      ui.leaveRow(row, () => closeTab(id));
    };

    const CLOSED_KEEP = 20;
    const closed = (() => {
      const kept = data.get("session", null)?.closed;
      return Array.isArray(kept) ? kept.filter((c) => c && c.url).slice(-CLOSED_KEEP) : [];
    })();

    const retire = (t) => {
      const at = tabs.indexOf(t);
      if (at < 0) return;
      if (t.url && t.url !== "about:blank") {
        closed.push({ url: t.url, title: t.title, icon: t.icon, at });
        closed.splice(0, Math.max(0, closed.length - CLOSED_KEEP));
      }
      releasePage(t, t.page);
      tabs.splice(at, 1);
    };
    const closeTab = (id) => {
      const at = tabs.findIndex((t) => t.id === id);
      if (at < 0) return;
      retire(tabs[at]);
      if (!tabs.length) return newTab();
      if (activeId === id) setActiveTab(tabs[Math.max(0, at - 1)].id); else { renderTabs(); persist(); }
    };

    /* All at once: closed one by one, each close would bring its neighbour forward on the way.
       A tab opened while the rows leave stays, and one that closed itself is not closed twice. */
    const closeOthers = (keepId) => {
      const keep = tabs.find((t) => t.id === keepId);
      if (!keep) return;
      const gone = tabs.filter((t) => t !== keep);
      const rows = gone.map((t) => tabList.querySelector(`[data-tab-id="${t.id}"]`)).filter(Boolean);
      let left = rows.length;
      const done = () => {
        for (const t of gone) retire(t);
        if (!tabs.length) return newTab();
        if (activeId !== keep.id && tabs.includes(keep)) setActiveTab(keep.id); else { renderTabs(); persist(); }
      };
      if (!left) return done();
      for (const r of rows) ui.leaveRow(r, () => { if (--left === 0) done(); });
    };

    const reopenTab = () => {
      const last = closed.pop();
      if (!last) return;
      const id = newTab(last.url, last.title || "", last.icon || "");
      const at = tabs.findIndex((t) => t.id === id);
      const want = Math.min(Math.max(0, last.at | 0), tabs.length - 1);
      if (at >= 0 && want !== at) tabs.splice(want, 0, tabs.splice(at, 1)[0]);
      renderTabs(); persist();
    };

    // A tab or a bookmark (both { url, icon }). A page that names no icon usually has /favicon.ico;
    // a file has none.
    const iconOf = (t) => t.icon || (/^https?:/i.test(t.url || "") ? (() => { try { return new URL("/favicon.ico", t.url).href; } catch { return ""; } })() : "");

    const favicon = (src) => {
      const box = document.createElement("span");
      Object.assign(box.style, { flex: "0 0 auto", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center" });
      if (!src) return box;
      const img = document.createElement("img");
      img.src = src; img.alt = ""; img.loading = "lazy"; img.draggable = false;
      Object.assign(img.style, { width: "16px", height: "16px", objectFit: "contain", borderRadius: "3px" });
      img.addEventListener("error", () => img.remove());
      box.appendChild(img);
      return box;
    };

    const folds = () => store.get("folds", {});
    const setFold = (key, on) => store.set("folds", { ...folds(), [key]: on });

    const tabList = ui.list(), markList = ui.list();
    ui.sortable(tabList, (from, to) => {
      const [t] = tabs.splice(from, 1);
      tabs.splice(to, 0, t);
      renderTabs(); persist();
    });
    ui.sortable(markList, (from, to) => bookmarks.move(from, to));

    const CAPTURE = [["microphone", "mic", "Using your microphone"], ["camera", "video", "Using your camera"],
                     ["screen", "monitor", "Sharing your screen"]];
    const tabMarks = (t) => {
      const box = document.createElement("span");
      Object.assign(box.style, { display: "flex", alignItems: "center", gap: "3px", flex: "0 0 auto" });
      for (const [kind, glyph, title] of CAPTURE) {
        if (!t.capture[kind]) continue;
        const m = document.createElement("span");
        m.innerHTML = ui.icon(glyph, 13);
        m.title = title;
        Object.assign(m.style, { display: "flex", color: ui.tone.alert });
        box.appendChild(m);
      }
      if (t.audible || t.muted) {
        box.appendChild(ui.iconBtn(ui.icon(t.muted ? "volumeOff" : "volume", 13), t.muted ? "Unmute tab" : "Mute tab",
          (e) => { e.stopPropagation(); t.page.mute(!t.muted); }, { size: "sm", quiet: true }));
      }
      return box;
    };

    // Through whenFree: a row being dragged or on its way out owns the list until it is done.
    const renderTabs = () => ui.whenFree(tabList, drawTabs);
    const drawTabs = () => {
      tabList.textContent = "";
      for (const t of tabs) {
        const r = ui.row();
        const label = document.createElement("span");
        label.textContent = t.title || placeOf(t.url) || "New tab";
        label.title = t.url;
        Object.assign(label.style, { flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
        r.prepend(t.loading ? ui.spinner(13) : favicon(iconOf(t)));
        r.dataset.tabId = String(t.id);   // dropTab finds the row by this, for a chord
        r.append(label, tabMarks(t), ui.miniBtn(ui.icon("x"), "Close tab", () => dropTab(t.id)));
        r.addEventListener("click", () => setActiveTab(t.id));
        ui.hoverable(r, () => t.id === activeId);
        tabList.appendChild(r);
      }
    };

    ui.contextMenu(tabList, {
      rowAt: (el) => el.closest?.("[data-tab-id]") || null,
      items: (r) => {
        const t = r && tabs.find((x) => String(x.id) === r.dataset.tabId);
        if (!t) return null;
        const marked = bookmarks.has(t.url);
        return [
          { label: "Reload", icon: "reload", hint: host.chordOf("reload"), run: () => t.page.reload() },
          { label: "Duplicate", icon: "window", run: () => newTab(t.url, t.title, t.icon) },
          { label: t.muted ? "Unmute Tab" : "Mute Tab", icon: t.muted ? "volume" : "volumeOff", run: () => t.page.mute(!t.muted) },
          "-",
          { label: "Copy Link", icon: "link", run: () => host.clipboard.writeText(t.url).catch(() => {}) },
          { label: marked ? "Remove Bookmark" : "Add Bookmark", icon: "bookmark", run: () => bookmarks.toggle(t.url, t.title || placeOf(t.url), t.icon) },
          "-",
          { label: "Close Tab", icon: "x", hint: host.chordOf("closeTab"), run: () => dropTab(t.id) },
          { label: "Close Other Tabs", disabled: tabs.length < 2, run: () => closeOthers(t.id) },
        ];
      },
    });

    const editDialog = (mark) => ui.dialog({
      title: "Edit bookmark",
      fields: [
        { key: "label", label: "Name", value: mark.label },
        { key: "url", label: "Address", value: mark.url },
      ],
      onConfirm: ({ label, url }) => {
        const address = parseAddress(url);
        if (!address) return notAnAddress(url.trim());
        if (!bookmarks.edit(mark.url, { label: label.trim() || mark.label, url: address })) {
          ui.dialog({ title: "Already a bookmark", message: address, confirmLabel: "OK", cancelLabel: "Close" });
        }
      },
    });

    const addDialog = () => ui.dialog({
      title: "Add bookmark",
      fields: [
        { key: "label", label: "Name", placeholder: "optional" },
        { key: "url", label: "Address", value: active()?.url || "" },
      ],
      confirmLabel: "Add",
      onConfirm: ({ label, url }) => {
        const address = parseAddress(url);
        if (address) bookmarks.add(address, label.trim()); else notAnAddress(url.trim());
      },
    });

    const markHead = ui.section("Bookmarks", {
      icon: ui.icon("bookmark", 16), actions: [{ title: "Add bookmark", run: () => addDialog() }],
      collapsed: !!folds().bookmarks, onCollapse: (on) => setFold("bookmarks", on),
    });
    const renderMarks = () => ui.whenFree(markList, drawMarks);
    const drawMarks = () => {
      markList.textContent = "";
      const list = bookmarks.all();
      for (const mark of list) {
        const r = ui.row();
        const label = document.createElement("span");
        label.textContent = mark.label;
        label.title = mark.url;
        Object.assign(label.style, { flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
        r.append(favicon(iconOf(mark)), label,
          ui.miniBtn(ui.icon("pencil"), "Edit name and address", () => editDialog(mark)),
          ui.miniBtn(ui.icon("x"), "Remove", () => ui.leaveRow(r, () => bookmarks.remove(mark.url))));
        r.dataset.url = mark.url;
        r.addEventListener("click", () => { const t = active(); if (t) navigate(t, mark.url); });
        ui.hoverable(r);
        markList.appendChild(r);
      }
      syncBar();
    };
    ui.contextMenu(markList, {
      rowAt: (el) => el.closest?.("[data-url]") || null,
      items: (r) => {
        const mark = r && bookmarks.all().find((b) => b.url === r.dataset.url);
        if (!mark) return null;
        return [
          { label: "Open", icon: "globe", run: () => { const t = active(); if (t) navigate(t, mark.url); } },
          { label: "Open in New Tab", icon: "window", run: () => newTab(mark.url, mark.label, mark.icon) },
          "-",
          { label: "Copy Link", icon: "link", run: () => host.clipboard.writeText(mark.url).catch(() => {}) },
          { label: "Edit\u2026", icon: "pencil", run: () => editDialog(mark) },
          { label: "Remove", icon: "x", run: () => { if (r.isConnected) ui.leaveRow(r, () => bookmarks.remove(mark.url)); else bookmarks.remove(mark.url); } },
        ];
      },
    });

    const findBar = document.createElement("div");
    Object.assign(findBar.style, {
      position: "absolute", zIndex: "3", top: `calc(${EDGE.top}px + var(--deckit-top-inset, 0px))`,
      display: "none", alignItems: "center", gap: "2px", boxSizing: "border-box",
      opacity: "0", transform: "translateY(-6px) scale(.98)",
      transition: `opacity ${ui.motion.fast} ${ui.motion.ease}, transform ${ui.motion.fast} ${ui.motion.ease}`,
      height: "36px", padding: "0 4px 0 2px", borderRadius: "999px", border: theme.border,
      background: ui.alpha(theme.contentBg, GLASS.open), backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
      boxShadow: "0 2px 10px rgba(0,0,0,.26)", color: theme.contentColor, font: "13px " + theme.font,
    });
    let finding = null;   // the tab a find is running on
    let asked = { query: "", caseSensitive: false };
    const findStep = (back) => {
      const t = active();
      if (!t || !asked.query) return;
      t.page.find(asked.query, { back, start: finding !== t, matchCase: asked.caseSensitive });
      finding = t;
    };
    const search = ui.searchBar({
      placeholder: "Find in page", options: ["case"], nav: true,
      onChange: (s) => {
        asked = s;
        const t = active();
        if (!t) return;
        if (!s.query) { t.page.stopFind(); finding = null; search.setCount(0, 0); return; }
        t.page.find(s.query, { start: true, matchCase: s.caseSensitive });
        finding = t;
      },
      onNext: () => findStep(false),
      onPrev: () => findStep(true),
      onEscape: () => closeFind({ keepSelection: true }),
    });
    Object.assign(search.style, { flex: "0 0 auto", width: "330px", margin: "0 2px" });
    const findClose = ui.iconBtn(ui.icon("x", 14), "Close", () => closeFind({ keepSelection: true }), { size: "sm" });
    findBar.append(search, findClose);
    content.appendChild(findBar);

    const showCount = (r) => search.setCount(r.active, r.matches);
    // The state lives here, not in the style: mid-fade the style says open while the bar is invisible.
    let findOpen = false;
    const openFind = () => {
      if (!active()) return;
      // Left only when the address capsule is top right.
      const left = corner === "tr";
      Object.assign(findBar.style, { left: left ? EDGE.side + "px" : "auto", right: left ? "auto" : EDGE.side + "px" });
      if (!findOpen) {
        findOpen = true;
        clearTimeout(findHide);
        findBar.style.display = "flex";
        // Laid out at the start position first, or there is nothing to animate.
        void findBar.offsetWidth;
        Object.assign(findBar.style, { opacity: "1", transform: "none" });
      }
      search.focus();
      if (asked.query) findStep(false);
    };
    let findHide = null;
    const closeFind = ({ keepSelection = false } = {}) => {
      if (!findOpen) return;
      findOpen = false;
      Object.assign(findBar.style, { opacity: "0", transform: "translateY(-6px) scale(.98)" });
      clearTimeout(findHide);
      findHide = setTimeout(() => { findBar.style.display = "none"; }, parseFloat(ui.motion.fast) || 0);
      finding?.page.stopFind({ keepSelection });
      finding = null;
      search.setCount(0, 0);
    };

    const tabHead = ui.section("Tabs", {
      icon: ui.icon("window", 16), actions: [{ title: "New tab", run: () => newTab() }],
      collapsed: !!folds().tabs, onCollapse: (on) => setFold("tabs", on),
    });
    tabHead.body.appendChild(tabList);
    markHead.body.appendChild(markList);
    sidebar.append(tabHead, markHead);
    content.append(island);

    const saved = data.get("session", null);
    if (saved && Array.isArray(saved.tabs) && saved.tabs.length) {
      const ids = saved.tabs.map((t) => newTab(t.url || HOME, t.title || "", t.icon || ""));
      const target = ids[Math.min(Math.max(0, saved.active | 0), ids.length - 1)];
      if (target) setActiveTab(target);
    } else {
      newTab(HOME);
    }
    renderMarks();

    return {
      content, sidebar,

      didAppear() {
        shown = true;
        const t = active();
        if (t?.held.length) askHeld(t);
      },
      didDisappear() { shown = false; },

      keys: {
        newTab: { key: "mod+t", label: "New tab", run: () => newTab() },
        reopenTab: { key: "mod+shift+t", label: "Reopen closed tab", run: reopenTab },
        find: { key: "mod+f", label: "Find in page", run: openFind },
        closeTab: { key: "mod+w", label: "Close tab", run: () => { const t = active(); if (t) dropTab(t.id); } },
        address: { key: "mod+l", label: "Address", run: openEditor },
        reload: { key: "mod+r", label: "Reload", run: reloadActive },
        back: { key: "mod+[", label: "Back", run: goBack },
        forward: { key: "mod+]", label: "Forward", run: goForward },
        ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`tab${n}`, {
          key: `mod+${n}`,
          label: `Tab ${n}`,
          run: () => { const t = tabs[n - 1]; if (t) setActiveTab(t.id); },
        }])),
        lastTab: {
          key: "mod+9",
          label: "Last tab",
          run: () => { const t = tabs[tabs.length - 1]; if (t) setActiveTab(t.id); },
        },
      },

      /* `target` is the window the page named: a second request for it reuses the tab that
         answered the first. Not persisted, since the name belongs to a running page. */
      open(url, { activates = true, target = "" } = {}) {
        const background = !activates;
        const address = parseAddress(url);
        if (!address) return false;
        const want = String(target || "");
        const held = want && tabs.find((t) => t.target === want);
        if (!background) host.show();
        if (held) {
          navigate(held, address);
          if (!background) setActiveTab(held.id);
          return true;
        }
        const id = newTab(address, "", "", !!background);
        if (!want) return true;
        const t = tabs.find((x) => x.id === id);
        if (t) t.target = want;
        return true;
      },

      // No search fallback here: in the switcher it would put a row above the ranked list on every keystroke.
      resolve: (query) => {
        const url = parseAddress(query);
        if (!url) return [];
        return [{
          label: "Open " + placeOf(url), hint: "In a new tab",
          icon: ui.icon("window", 16),
          run: () => { host.show(); newTab(url); },
        }];
      },

      // Bookmarks and tabs are pages, not rows, so a long list does not bury every other plugin.
      commands: () => [
        {
          label: "New Tab\u2026", icon: ui.icon("window", 16),
          keywords: ["웹", "웹페이지", "열기", "주소", "새탭", "url", "open", "web", "address", "new tab"],
          run: () => ui.dialog({
            title: "New Tab",
            fields: [{ key: "url", label: "Address", placeholder: "example.com" }],
            confirmLabel: "Open",
            onConfirm: ({ url }) => {
              const raw = String(url || "").trim();
              if (!raw) return;
              const address = parseAddress(raw);
              if (!address) return notAnAddress(raw);
              host.show();
              newTab(address);
            },
          }),
        },
        ...(closed.length ? [{
          label: "Reopen Closed Tab",
          hint: closed[closed.length - 1].title || placeOf(closed[closed.length - 1].url),
          icon: ui.icon("window", 16),
          keywords: ["닫은탭", "다시열기", "복구", "reopen", "undo", "closed tab"],
          run: () => { host.show(); reopenTab(); },
        }] : []),
        {
          label: "Search Bookmarks", icon: ui.icon("bookmark", 16),
          keywords: ["북마크", "즐겨찾기", "bookmarks"],
          page: { placeholder: "Search bookmarks", entries: () => bookmarks.all().map((m) => ({
            label: m.label, hint: placeOf(m.url), icon: ui.icon("bookmark"), address: m.url,
            run: () => { host.show(); newTab(m.url); },
          })) },
        },
        {
          label: "Search Tabs", icon: ui.icon("window", 16),
          keywords: ["탭", "tabs"],
          page: { placeholder: "Search open tabs", entries: () => tabs.map((t) => ({
            label: t.title || placeOf(t.url) || "New tab", hint: placeOf(t.url), icon: ui.icon("window"), address: t.url || "",
            run: () => { host.show(); setActiveTab(t.id); },
          })) },
        },
      ],
    };
  },
});
