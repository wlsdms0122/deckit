Deckit.register({
  order: 100,                 // last in the list
  keywords: ["설정", "플러그인", "settings", "plugins"],
  icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,

  make({ theme, ui, host }) {
    const APP = host.about().name;
    const content = document.createElement("div");
    Object.assign(content.style, {
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      color: theme.contentColor, font: "14px " + theme.font, overflow: "hidden",
    });

    const head = document.createElement("div");
    Object.assign(head.style, { flex: "0 0 auto", padding: "12px 14px 8px" });
    const headTitle = document.createElement("div");
    headTitle.textContent = "Settings";
    Object.assign(headTitle.style, { font: "700 15px " + theme.font });
    head.appendChild(headTitle);

    const body = document.createElement("div");
    Object.assign(body.style, { flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "4px 14px 16px" });

    const block = (title, note) => {
      const root = document.createElement("div");
      Object.assign(root.style, { marginBottom: "22px" });
      const h = document.createElement("div");
      Object.assign(h.style, {
        display: "flex", alignItems: "center", gap: "8px", minHeight: "24px", padding: "0 0 6px",
      });
      const label = document.createElement("div");
      label.textContent = title;
      Object.assign(label.style, {
        flex: "1 1 auto", font: "700 11.5px " + theme.font, letterSpacing: ".06em",
        textTransform: "uppercase", opacity: ".45",
      });
      h.appendChild(label);
      root.appendChild(h);
      root.head = h;
      root.heading = title; // not `title`, which is the tooltip
      if (note) {
        const n = document.createElement("div");
        n.textContent = note;
        Object.assign(n.style, { opacity: ".45", font: "12.5px " + theme.font, padding: "0 0 8px", lineHeight: "1.5" });
        root.appendChild(n);
      }
      const inner = document.createElement("div");
      root.appendChild(inner);
      root.body = inner;
      return root;
    };

    const chip = (text, tone) => {
      const el = document.createElement("span");
      el.textContent = text;
      Object.assign(el.style, {
        flex: "0 0 auto", padding: "1px 7px", borderRadius: "999px", border: theme.border,
        font: "11.5px " + theme.font, opacity: tone === "muted" ? ".45" : ".75",
      });
      return el;
    };

    const PLUGIN_COLUMNS = "minmax(96px, 180px) 56px minmax(0, 1fr) auto";
    const plugins = block(
      "Plugins",
      "A plugin is a folder: manifest.toml, view.js and what goes with them, under plugins/ in " +
      "the app's folder (below). What it contributes is listed rather than what kind of thing it is: " +
      "these are not exclusive and most plugins give more than one. `view` is the one that " +
      "earns a row in the list on the left; without it a plugin lives in the quick switcher alone. " +
      "Open a row for what it requires, the keys it adds and where it lives.",
    );

    const takeChange = async (done) => {
      say(done + " Reloading\u2026");
      try { await host.plugins.refresh(done); }
      catch (e) { say(`${done} It could not be taken now (${(e && e.message) || e}); restart ${APP} to finish.`); }
    };

    const notice = document.createElement("div");
    Object.assign(notice.style, {
      display: "none", margin: "8px 0 0", padding: "8px 10px", borderRadius: "7px",
      border: theme.border, font: "12.5px " + theme.font, lineHeight: "1.6", opacity: ".8",
    });
    const say = (text) => { notice.textContent = text; notice.style.display = "block"; };
    // What takeChange said before the reload, carried over by host.plugins.refresh.
    const said = host.plugins.said();
    if (said) say(said);

    const PERMISSION_ICONS = {
      "system.main-process": "server", "system.files": "fileText", "system.network": "globe", "system.certificates": "shieldCheck",
      "system.site-permissions": "mic", "system.clipboard": "copy", "system.notifications": "bell",
      "deckit.plugins": "puzzle", "deckit.plugin-settings": "sliders", "deckit.key-map": "keyboard", "deckit.url-schemes": "layers",
    };
    const permissionList = (permissions) => {
      const list = document.createElement("div");
      Object.assign(list.style, { border: theme.border, borderRadius: "10px", overflow: "hidden" });
      permissions.forEach((p, i) => {
        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", columnGap: "11px",
          padding: "10px 12px", borderTop: i ? theme.border : "0",
        });
        const tile = document.createElement("div");
        tile.innerHTML = ui.icon(PERMISSION_ICONS[p.id], 15);
        Object.assign(tile.style, {
          width: "28px", height: "28px", borderRadius: "7px", display: "flex", alignItems: "center",
          justifyContent: "center", background: ui.alpha(ui.accent, 0.16), color: ui.accent,
        });
        const words = document.createElement("div");
        const line = (text, style) => {
          const el = document.createElement("div");
          el.textContent = text;
          Object.assign(el.style, { lineHeight: "1.45", overflowWrap: "anywhere" }, style);
          words.appendChild(el);
        };
        const head = document.createElement("div");
        Object.assign(head.style, { display: "flex", alignItems: "baseline", flexWrap: "wrap", columnGap: "8px", lineHeight: "1.45" });
        const label = document.createElement("span");
        label.textContent = p.label;
        label.style.font = "600 13.5px " + theme.font;
        const id = document.createElement("span");
        id.textContent = p.id;
        Object.assign(id.style, { font: "11.5px ui-monospace, SFMono-Regular, Menlo, monospace", opacity: ".5", overflowWrap: "anywhere" });
        head.append(label, id);
        words.appendChild(head);
        line(p.reason, { font: "13px " + theme.font, opacity: ".85", marginTop: "2px" });
        line(p.means, { font: "12px " + theme.font, opacity: ".5", marginTop: "4px" });
        row.append(tile, words);
        list.appendChild(row);
      });
      return list;
    };

    const asked = (permissions) => {
      const root = document.createElement("div");
      const trust = document.createElement("div");
      trust.textContent = "These say what it means to do, not what it is kept from: plugins share one page with the app. "
        + "Install it only if you trust where it came from.";
      Object.assign(trust.style, { font: "12px " + theme.font, lineHeight: "1.5", opacity: ".5", marginTop: "10px" });
      root.append(permissionList(permissions), trust);
      return root;
    };
    const installBtn = ui.textBtn("Install Plugin", "", async () => {
      let picked;
      try { picked = await host.plugins.pick(); }
      catch (e) { return say("Could not install: " + ((e && e.message) || e)); }
      if (!picked) return;                     // the picker was cancelled
      const install = async () => {
        let done;
        try { done = await host.plugins.install(picked.from); }
        catch (e) { return say("Could not install: " + ((e && e.message) || e)); }
        const what = `${done.name} ${done.version || ""}`.trim();
        takeChange(`${done.replaced ? "Replaced" : "Installed"} ${what}.`);
      };
      const asks = picked.permissions.length > 0;
      if (!asks && !picked.replaces) return install();
      const verb = picked.replaces ? "Replace" : "Install";
      const what = `${picked.name} ${picked.version || ""}`.trim();
      ui.dialog({
        title: `${verb} ${picked.name}?`,
        message: [
          picked.replaces ? `It replaces the installed ${picked.name}. What it stored is kept.` : "",
          asks ? `${what} asks for:` : "",
        ],
        content: asks ? asked(picked.permissions) : null,
        confirmLabel: verb,
        cancelLabel: "Cancel",
        onConfirm: install,
      });
    }, { size: "sm", icon: ui.icon("plus", 14) });
    plugins.head.appendChild(installBtn);

    const pluginHead = document.createElement("div");
    Object.assign(pluginHead.style, {
      display: "grid", gridTemplateColumns: PLUGIN_COLUMNS, alignItems: "center", gap: "10px",
      padding: "0 8px 5px", font: "700 11px " + theme.font, letterSpacing: ".05em",
      textTransform: "uppercase", opacity: ".35", borderBottom: theme.border,
    });
    ["NAME", "VERSION", "CONTRIBUTES", ""].forEach((t) => {
      const c = document.createElement("div");
      c.textContent = t;
      // Over the name rather than the caret in front of it.
      if (t === "NAME") c.style.paddingLeft = "13px";
      pluginHead.appendChild(c);
    });

    const pluginRows = document.createElement("div");

    const filesWord = (s) => (s.count === 0 && s.hidden ? "hidden files"
      : `${s.count}${s.capped ? "+" : ""} ${s.count === 1 && !s.capped ? "file" : "files"}${s.hidden ? " and hidden ones" : ""}`);
    const askRemove = async (entry) => {
      let kept;
      try { kept = await host.plugins.dataCount(entry.id); }
      catch (e) { return say("Could not tell what it stores: " + ((e && e.message) || e)); }
      const stored = kept.count > 0 || kept.hidden;
      const onDisk = host.plugins.installed();
      const needing = onDisk.filter((d) => d.requires && d.requires[entry.id]).map((d) => d.name);
      const restore = onDisk.find((d) => d.id === entry.id)?.restore;
      const breaks = needing.length
        ? ` ${needing.join(", ")} ${needing.length === 1 ? "requires" : "require"} it and will stop loading.`
        : "";
      const gone = (alsoData) => async () => {
        try { await host.plugins.remove(entry.id, alsoData); }
        catch (e) { return say("Could not remove: " + ((e && e.message) || e)); }
        takeChange(`Removed ${entry.name}${alsoData ? " and its data" : ""}.`);
      };
      ui.dialog({
        title: `Remove ${entry.name}?`,
        message: [
          stored
            ? `This deletes the plugin's code. Its ${filesWord(kept)} in data/${entry.id}/ will be kept `
              + "unless you say otherwise: keeping them means a reinstall picks up where you left off."
            : "This deletes the plugin's code. It has nothing stored.",
          breaks.trim(),
          // Settings itself can be removed, leaving no Install button: the app's `restore` says what brings it back.
          "To bring it back, install its folder again with Install Plugin." + (restore ? " " + restore : ""),
        ],
        confirmLabel: "Remove",
        cancelLabel: "Cancel",
        // Removing the data is never the primary answer, so Enter cannot reach it.
        extraLabel: stored ? "Remove with data" : null,
        onExtra: stored ? gone(true) : null,
        destructive: true,
        onConfirm: gone(false),
      });
    };

    // Opens by its grid row (0fr to 1fr), which animates to the content's height without measuring it.
    const details = (id, { live, requirements }, { onDisk, openLines }) => {
      const fold = document.createElement("div");
      // The base duration, not the fast one: over the short one a tall row reads as a jump.
      const MOVE = `grid-template-rows ${ui.motion.base} ${ui.motion.ease}, opacity ${ui.motion.base} ${ui.motion.ease}`;
      Object.assign(fold.style, { display: "grid", gridTemplateRows: "0fr", opacity: "0", cursor: "default", transition: MOVE });
      fold.addEventListener("click", (e) => e.stopPropagation());
      const inner = document.createElement("div");
      Object.assign(inner.style, { overflow: "hidden", minHeight: "0" });
      const box = document.createElement("div");
      Object.assign(box.style, {
        margin: "2px 8px 8px 21px", padding: "10px 12px", borderRadius: "8px",
        background: "rgba(128,128,128,.08)", display: "flex", flexDirection: "column", gap: "10px",
        font: "12.5px " + theme.font,
      });
      inner.appendChild(box);
      fold.appendChild(inner);

      const part = (title, body) => {
        const r = document.createElement("div");
        Object.assign(r.style, { display: "flex", flexDirection: "column", gap: "5px" });
        const h = document.createElement("div");
        h.textContent = title;
        Object.assign(h.style, { font: "700 10.5px " + theme.font, letterSpacing: ".06em", textTransform: "uppercase", opacity: ".4" });
        r.append(h, body);
        box.appendChild(r);
      };
      const wrap = () => {
        const w = document.createElement("div");
        Object.assign(w.style, { display: "flex", flexWrap: "wrap", gap: "6px" });
        return w;
      };
      const pill = (text, ok) => {
        const el = document.createElement("span");
        Object.assign(el.style, {
          display: "inline-flex", alignItems: "center", gap: "6px", padding: "2px 8px",
          borderRadius: "999px", border: theme.border, whiteSpace: "nowrap",
        });
        const dot = document.createElement("span");
        Object.assign(dot.style, { width: "6px", height: "6px", borderRadius: "50%", background: ok ? ui.tone.ok : ui.tone.alert });
        const t = document.createElement("span");
        t.textContent = text;
        el.append(dot, t);
        return el;
      };

      if (requirements?.length) {
        const w = wrap();
        for (const r of requirements) w.appendChild(pill(`${r.name} ${r.want}`, r.ok));
        part("Requires", w);
      }

      // From the folder, not the running plugin, so a plugin whose view failed still shows what its main half was given.
      const disk = onDisk.find((d) => d.id === id);
      if (disk?.permissions.length) part("Permissions", permissionList(disk.permissions));

      if (live?.urlSchemes.length) {
        const w = wrap();
        for (const openLine of openLines.filter((openLine) => openLine.providers.some((p) => p.id === id))) {
          const me = openLine.providers.find((p) => p.id === id);
          // Counted among the ones switched on: a plugin switched off ahead of it is never asked.
          const at = openLine.providers.filter((p) => p.on).findIndex((p) => p.id === id);
          const nth = ["1st", "2nd", "3rd"][at] || `${at + 1}th`;
          w.appendChild(pill(`${openLine.name} \u00b7 ${me?.on ? "asked " + nth : "off"}`, !!me?.on));
        }
        part("Opens", w);
      }

      if (live?.keys.length) {
        const grid = document.createElement("div");
        Object.assign(grid.style, { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "4px 14px" });
        for (const k of live.keys) {
          const r = document.createElement("div");
          Object.assign(r.style, { display: "flex", alignItems: "center", gap: "8px", minWidth: "0" });
          const chord = document.createElement("span");
          chord.textContent = k.chord;
          Object.assign(chord.style, {
            flex: "0 0 auto", minWidth: "26px", textAlign: "center", padding: "0 5px", borderRadius: "4px",
            border: theme.border, font: "11.5px " + theme.font, lineHeight: "18px", opacity: ".8",
          });
          const l = document.createElement("span");
          l.textContent = k.label;
          l.title = k.label;
          Object.assign(l.style, { minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: ".85" });
          r.append(chord, l);
          grid.appendChild(r);
        }
        part("Keys", grid);
      }

      const place = document.createElement("div");
      Object.assign(place.style, { display: "flex", flexDirection: "column", gap: "2px" });
      const line = (text, quiet) => {
        const l = document.createElement("div");
        l.textContent = text;
        l.title = text;
        Object.assign(l.style, { overflowWrap: "anywhere", opacity: quiet ? ".45" : ".85", font: (quiet ? "12px " : "12.5px ") + theme.font });
        place.appendChild(l);
      };
      if (disk?.dir) line(home(disk.dir), false);
      const runs = disk?.hasMain && !disk.mainRunning ? "main.js did not load" : "";
      line(runs, true);
      const said = place.lastChild;
      // Counted when the row is first opened: it walks the data folder, and most rows are never opened.
      let counted = false;
      const countNow = () => {
        if (counted) return;
        counted = true;
        host.plugins.dataCount(id).then((kept) => {
          said.textContent = said.title = [runs, kept.count || kept.hidden ? `${filesWord(kept)} in data/${id}/` : "Nothing stored"].filter(Boolean).join(" \u00b7 ");
        }, () => {});
      };
      part("Location", place);

      fold.setOpen = (open, animate) => {
        if (open) countNow();
        if (!animate) fold.style.transition = "none";
        fold.style.gridTemplateRows = open ? "1fr" : "0fr";
        fold.style.opacity = open ? "1" : "0";
        if (!animate) requestAnimationFrame(() => { fold.style.transition = MOVE; });
      };
      return fold;
    };

    // Survives a re-render (every visit redraws the list), not a reload.
    const opened = new Set();

    const pluginIcons = new Map();   // plugin id -> icon, as the list was last drawn
    const renderPlugins = () => {
      // Read once per drawing: asking for the running list asks every plugin for its commands.
      const live = host.plugins.running();
      const onDisk = host.plugins.installed();
      const lists = { onDisk, openLines: host.urlSchemes.list() };
      for (const p of live) pluginIcons.set(p.id, p.icon);
      renderPending(onDisk);
      pluginRows.textContent = "";
      const seen = new Set();

      // `error`: why it is not running. `problem`: what went wrong with one that is.
      const rowFor = (id, { name, version, installed, dir, error, problem, live, requirements }) => {
        const entry = document.createElement("div");
        Object.assign(entry.style, { cursor: "pointer" });
        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "grid", gridTemplateColumns: PLUGIN_COLUMNS, alignItems: "center", gap: "10px",
          minHeight: "34px", padding: "0 8px", borderRadius: "6px",
          transition: `background-color ${ui.motion.fast} ${ui.motion.ease}`,
        });

        const nameCell = document.createElement("span");
        Object.assign(nameCell.style, { display: "flex", alignItems: "center", gap: "4px", minWidth: "0" });
        const caret = document.createElement("span");
        caret.innerHTML = ui.icon("chevronRight", 13);
        Object.assign(caret.style, {
          display: "flex", flex: "0 0 auto", opacity: ".45", marginLeft: "-4px",
          transition: `transform ${ui.motion.fast} ${ui.motion.ease}`,
        });
        const nameText = document.createElement("span");
        nameText.textContent = name;
        nameText.title = name;
        Object.assign(nameText.style, {
          minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          opacity: error ? ".45" : "1",
        });
        nameCell.append(caret, nameText);

        const ver = document.createElement("span");
        ver.textContent = version || "—";
        Object.assign(ver.style, {
          flex: "0 0 auto", opacity: version ? ".5" : ".25",
          font: "11.5px " + theme.font, fontVariantNumeric: "tabular-nums",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        });

        const gives = document.createElement("div");
        Object.assign(gives.style, { display: "flex", gap: "5px", flexWrap: "wrap", minWidth: "0" });
        if (live) {
          if (live.view) gives.appendChild(chip("view"));
          if (live.sidebar) gives.appendChild(chip("sidebar"));
          if (live.commands) gives.appendChild(chip(live.commands + (live.commands === 1 ? " command" : " commands")));
          if (live.keys.length) gives.appendChild(chip(live.keys.length + (live.keys.length === 1 ? " key" : " keys")));
          if (live.now) gives.appendChild(chip("now"));
          if (live.resolver) gives.appendChild(chip("resolver"));
          for (const scheme of live.urlSchemes) gives.appendChild(chip("opens: " + (scheme === host.urlSchemes.everyScheme ? "every scheme" : scheme + ":")));
          if (live.exports) gives.appendChild(chip("exports"));
        }
        if (!gives.children.length) gives.appendChild(chip("\u2014", "muted"));

        const actions = document.createElement("div");
        Object.assign(actions.style, { display: "flex", alignItems: "center", gap: "2px", flex: "0 0 auto" });
        actions.appendChild(ui.miniBtn(ui.icon("externalWindow", 14), "Open the plugin folder",
          () => host.plugins.reveal(id)));
        if (installed) {
          actions.appendChild(ui.miniBtn(ui.icon("x", 14), "Remove this plugin",
            () => askRemove({ id, name })));
        } else {
          const kept = chip("source", "muted");
          kept.title = `Read from ${dir || "a source folder"}, not installed: it is removed there, not here.`;
          actions.appendChild(kept);
        }

        row.append(nameCell, ver, gives, actions);
        ui.hoverable(row, () => false, { shows: () => opened.has(id) });
        entry.appendChild(row);

        if (error || problem) {
          const why = document.createElement("div");
          why.textContent = error || problem;
          Object.assign(why.style, {
            padding: "0 8px 8px 21px", marginTop: "-6px", color: ui.tone.alert,
            font: "12px " + theme.font, lineHeight: "1.5", wordBreak: "break-word",
          });
          // Selectable: this is what gets pasted into a bug report.
          entry.appendChild(ui.selectable(why));
        }

        entry.appendChild(details(id, { live, requirements }, lists));
        const paint = (animate) => {
          const open = opened.has(id);
          caret.style.transform = open ? "rotate(90deg)" : "none";
          entry.lastChild.setOpen(open, animate);
          row.repaint();
        };
        row.addEventListener("click", () => {
          if (opened.has(id)) opened.delete(id); else opened.add(id);
          paint(true);
        });
        paint(false);
        pluginRows.appendChild(entry);
      };

      // Running plugins first, in the order the panel loaded them, so the list matches the nav.
      for (const p of live) {
        const disk = onDisk.find((d) => d.id === p.id);
        seen.add(p.id);
        rowFor(p.id, {
          name: p.name, version: disk?.version, installed: disk?.installed, dir: disk?.dir,
          live: p, requirements: disk?.requirements,
          problem: disk?.mainError ? "main.js did not load: " + disk.mainError : p.problem,
        });
      }
      for (const d of onDisk) {
        if (seen.has(d.id)) continue;
        rowFor(d.id, {
          name: d.name, version: d.version, installed: d.installed, dir: d.dir,
          error: d.error || "did not load", requirements: d.requirements,
        });
      }
    };

    /* A main half runs in the app's main process, which no panel reload reaches: when its code
       changed underneath it, only a restart finishes. Asked on every render, since the reload forgot. */
    const pending = document.createElement("div");
    Object.assign(pending.style, {
      display: "none", alignItems: "center", gap: "10px", margin: "8px 0 0",
      padding: "8px 8px 8px 10px", borderRadius: "7px", border: theme.border,
      font: "12.5px " + theme.font, lineHeight: "1.5",
    });
    const pendingText = document.createElement("div");
    Object.assign(pendingText.style, { flex: "1 1 auto", minWidth: "0", opacity: ".85" });
    const restartBtn = ui.textBtn("Restart " + APP, "", async () => {
      restartBtn.setEnabled(false).setText("Restarting\u2026");
      try { await host.plugins.restart(); }
      catch (e) {
        restartBtn.setEnabled(true).setText("Restart " + APP);
        say("Could not restart: " + ((e && e.message) || e));
      }
    }, { size: "sm" });
    pending.append(pendingText, restartBtn);

    const renderPending = (onDisk) => {
      const list = host.plugins.restartPending();
      if (!list.length) { pending.style.display = "none"; return; }
      const nameOf = (id) => onDisk.find((d) => d.id === id)?.name || id;
      const named = (why) => list.filter((x) => x.why === why).map((x) => nameOf(x.id));
      const updated = named("updated"), removed = named("removed"), reinstalled = named("reinstalled");
      const parts = [];
      if (updated.length) parts.push(`${updated.join(", ")} updated, but the part that runs in the background is still the old one`);
      if (removed.length) parts.push(`${removed.join(", ")} removed, but what it started is still running`);
      if (reinstalled.length) parts.push(`${reinstalled.join(", ")} reinstalled, but what the earlier copy started is still running`);
      pendingText.textContent = parts.join(". ") + ". A restart finishes it.";
      pending.style.display = "flex";
    };

    plugins.body.append(pluginHead, pluginRows, pending, notice);

    const pluginSettings = block(
      "Plugin Settings",
      "Choices each plugin offers. A plugin declares them; they are kept with its data, so an update keeps them.",
    );
    const pluginSettingRows = document.createElement("div");
    pluginSettings.body.appendChild(pluginSettingRows);
    const settingCards = new Map();   // plugin id -> its card, for showCard

    const renderPluginSettings = () => {
      pluginSettingRows.textContent = "";
      settingCards.clear();
      const groups = host.pluginSettings.list();
      if (!groups.length) {
        const none = document.createElement("div");
        none.textContent = "No plugin has settings.";
        Object.assign(none.style, { opacity: ".45", font: "12.5px " + theme.font, padding: "0 8px" });
        pluginSettingRows.appendChild(none);
        return;
      }
      for (const g of groups) {
        const group = document.createElement("div");
        Object.assign(group.style, {
          marginBottom: "10px", padding: "8px 0 4px", borderRadius: "8px", border: theme.border,
          transition: `background ${ui.motion.slow} ${ui.motion.ease}`,
        });
        settingCards.set(g.id, group);
        const title = document.createElement("div");
        title.textContent = g.name;
        Object.assign(title.style, { font: "600 13px " + theme.font, padding: "0 12px 4px" });
        group.appendChild(title);
        for (const item of g.items) {
          const row = document.createElement("div");
          Object.assign(row.style, { display: "flex", alignItems: "center", gap: "12px", minHeight: "36px", padding: "4px 12px" });
          const words = document.createElement("div");
          Object.assign(words.style, { flex: "1 1 auto", minWidth: "0", display: "flex", flexDirection: "column", gap: "1px" });
          const name = document.createElement("div");
          name.textContent = item.label;
          Object.assign(name.style, { font: "13px " + theme.font });
          words.appendChild(name);
          if (item.hint) {
            const hint = document.createElement("div");
            hint.textContent = item.hint;
            Object.assign(hint.style, { font: "12px " + theme.font, opacity: ".5", lineHeight: "1.45" });
            words.appendChild(hint);
          }
          // A value out of bounds throws at once, a failed write rejects later: the await catches both.
          const set = async (v) => {
            try { await host.pluginSettings.set(g.id, item.key, v); }
            catch (e) { say("Could not change the setting: " + ((e && e.message) || e)); }
          };
          // `absent`: a saved value no longer among the choices, labeled rather than shown as nothing chosen.
          const options = item.type === "choice"
            ? item.options.map((o) => (o.absent ? { ...o, label: o.label + " (not available)" } : o)) : [];
          let control;
          if (item.type === "toggle") control = ui.toggle({ on: !!item.value, onChange: (on) => set(on) });
          else if (item.type === "choice" && !item.computed && options.length <= 4) {
            control = ui.segmented(options.map((o) => ({ key: o.value, label: o.label })), { value: item.value, size: "sm", onChange: set });
          } else if (item.type === "choice") control = ui.select(options, { value: item.value, onChange: set });
          else if (item.type === "number") {
            control = ui.stepper({ value: item.value, min: item.min, max: item.max, step: item.step || 1, unit: item.unit, onChange: set });
          } else if (item.type === "text") {
            control = ui.field({ value: item.value || "", placeholder: item.placeholder, size: "sm", onEnter: (v) => set(v) });
            Object.assign(control.style, { flex: "0 0 220px" });
            control.input.addEventListener("blur", () => set(control.input.value));
          } else if (item.type === "action") {
            const said = document.createElement("div");
            Object.assign(said.style, { font: "12px " + theme.font, opacity: ".6", lineHeight: "1.45", display: "none" });
            words.appendChild(said);
            control = ui.textBtn(item.button, item.label, async () => {
              said.style.display = "none";
              let text = "";
              try { text = await host.pluginSettings.run(g.id, item.key); }
              catch (e) { text = "Did not work: " + ((e && e.message) || e); }
              said.textContent = text;
              said.style.display = text ? "block" : "none";
            });
          } else continue;
          row.append(words, control);
          group.appendChild(row);
        }
        pluginSettingRows.appendChild(group);
      }
    };

    const urlSchemes = block(
      "URL Schemes",
      "Addresses by their scheme, and the plugins that open them. Plugins are asked in order, " +
      "and one may pass; drag to change the order, switch one off to skip it. When every plugin " +
      `passes, ${APP} opens it the default way, for a scheme it has one for.`,
    );
    const schemeRows = document.createElement("div");
    urlSchemes.body.appendChild(schemeRows);

    const renderURLSchemes = () => {
      schemeRows.textContent = "";
      for (const openLine of host.urlSchemes.list()) {
        const group = document.createElement("div");
        Object.assign(group.style, {
          marginBottom: "10px", padding: "8px 0 4px", borderRadius: "8px", border: theme.border,
        });
        const name = document.createElement("div");
        name.textContent = openLine.name;
        Object.assign(name.style, { font: "600 13px " + theme.font, padding: "0 12px" });
        const when = document.createElement("div");
        when.textContent = openLine.when;
        Object.assign(when.style, { font: "12px " + theme.font, opacity: ".5", padding: "1px 12px 6px" });
        group.append(name, when);

        const save = (providers) => host.urlSchemes.set(openLine.id, {
          order: providers.map((p) => p.id),
          off: providers.filter((p) => !p.on).map((p) => p.id),
        });
        const providers = openLine.providers;
        const list = ui.list();
        ui.sortable(list, (from, to) => {
          const next = [...providers];
          next.splice(to, 0, next.splice(from, 1)[0]);
          save(next);
          renderURLSchemes();
        });

        const line = (place, labelText, trailing, { muted = false, drag = false } = {}) => {
          const r = document.createElement("div");
          Object.assign(r.style, {
            display: "flex", alignItems: "center", gap: "8px", minHeight: "32px", padding: "0 8px 0 6px",
            margin: "0 4px", borderRadius: "6px", cursor: drag ? "grab" : "default",
            transition: `background-color ${ui.motion.fast} ${ui.motion.ease}`,
          });
          if (drag) ui.hoverable(r);
          const grip = document.createElement("span");
          grip.innerHTML = drag ? ui.icon("grip", 14) : "";
          Object.assign(grip.style, { display: "flex", flex: "0 0 14px", opacity: ".35" });
          const n = document.createElement("span");
          n.textContent = place;
          Object.assign(n.style, {
            flex: "0 0 16px", textAlign: "right", font: "12px " + theme.font,
            fontVariantNumeric: "tabular-nums", opacity: ".4",
          });
          const l = document.createElement("span");
          l.textContent = labelText;
          Object.assign(l.style, { flex: "1 1 auto", minWidth: "0", font: "13px " + theme.font, opacity: muted ? ".55" : "1",
                                   overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
          l.title = labelText;
          r.append(grip, n, l, trailing);
          return r;
        };
        providers.forEach((p, i) => {
          const sw = ui.toggle({
            on: p.on,
            onChange: (on) => { providers[i] = { ...p, on }; save(providers); renderURLSchemes(); },
          });
          sw.title = p.on ? `${p.name} is asked ${i === 0 ? "first" : "in this place"}` : `${p.name} is skipped`;
          list.appendChild(line(String(i + 1), p.name, sw, { muted: !p.on, drag: true }));
        });
        if (!providers.length) {
          const none = document.createElement("div");
          none.textContent = "No plugin takes this over.";
          Object.assign(none.style, { font: "12.5px " + theme.font, opacity: ".4", padding: "4px 12px 6px 44px" });
          group.appendChild(none);
        }
        group.appendChild(list);
        const fallback = openLine.fallback
          ? line("\u2014", openLine.fallback, chip("Default", "muted"), { muted: true })
          : line("\u2014", "Nothing opens it", document.createElement("span"), { muted: true });
        fallback.title = openLine.fallback
          ? `${APP}'s own answer. It is always last and cannot be switched off.`
          : `${APP} has no answer of its own here: when every plugin passes, the address is not opened.`;
        group.appendChild(fallback);
        schemeRows.appendChild(group);
      }
    };

    const keyboard = block(
      "Keyboard",
      "Click a shortcut to record a new one: Esc cancels, \u232b clears it. Plugins may share a " +
      "chord, since only one is on screen at a time. A change onto a chord already in use is not " +
      "applied until that chord is free.",
    );
    const keyboardRows = document.createElement("div");
    keyboard.body.appendChild(keyboardRows);
    const clashes = chip("", "muted");
    Object.assign(clashes.style, { color: ui.tone.alert, borderColor: ui.alpha(ui.tone.alert, 0.5), opacity: "1", display: "none" });
    keyboard.head.appendChild(clashes);

    const SCOPE = { global: "Everywhere", panel: "On any plugin" };
    let stopRecording = null;
    const renderKeyboard = () => {
      stopRecording?.();
      stopRecording = null;
      keyboardRows.textContent = "";
      const all = host.keymap.list();
      const errors = all.filter((k) => k.issues.some((i) => i.level === "error")).length;
      clashes.textContent = `${errors} conflict${errors === 1 ? "" : "s"}`;
      clashes.style.display = errors ? "" : "none";

      const owners = [...new Set(all.map((k) => k.owner))];
      for (const owner of owners) {
        const mine = all.filter((k) => k.owner === owner);
        const group = document.createElement("div");
        Object.assign(group.style, { marginBottom: "10px", padding: "8px 0 6px", borderRadius: "8px", border: theme.border });
        const title = document.createElement("div");
        title.textContent = mine[0].ownerName;
        Object.assign(title.style, { font: "600 13px " + theme.font, padding: "0 12px 4px" });
        const grid = document.createElement("div");
        Object.assign(grid.style, { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", columnGap: "8px", padding: "0 4px" });
        group.append(title, grid);

        for (const k of mine) {
          const cellBox = document.createElement("div");
          Object.assign(cellBox.style, { padding: "0 8px", borderRadius: "6px", minWidth: "0" });
          const line = document.createElement("div");
          Object.assign(line.style, { display: "flex", alignItems: "center", gap: "8px", minHeight: "30px" });
          const name = document.createElement("span");
          Object.assign(name.style, { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: "13px " + theme.font });
          name.textContent = k.label;
          name.title = k.label;
          line.appendChild(name);
          if (SCOPE[k.scope]) {
            const where = document.createElement("span");
            where.textContent = SCOPE[k.scope];
            Object.assign(where.style, { flex: "0 0 auto", font: "11.5px " + theme.font, opacity: ".4" });
            line.appendChild(where);
          }

          const worst = k.issues.find((i) => i.level === "error") ? ui.tone.alert : k.issues.length ? ui.tone.warn : null;
          const key = document.createElement("button");
          key.type = "button";
          Object.assign(key.style, {
            flex: "0 0 auto", minWidth: "56px", height: "22px", padding: "0 8px", borderRadius: "5px",
            border: worst ? `1px solid ${worst}` : theme.border, background: "transparent",
            color: worst || "inherit", font: "12px " + theme.font, cursor: "pointer",
            opacity: k.spec ? "1" : ".45",
          });
          const show = (text) => { key.textContent = text; };
          show(k.spec ? k.chord : "None");
          key.title = k.changed ? `Changed from ${k.defaultChord || "none"}` : "Click to change";
          key.addEventListener("click", (e) => {
            e.stopPropagation();
            stopRecording?.();
            show("Press a shortcut\u2026");
            Object.assign(key.style, { borderColor: ui.accent, color: ui.accent, opacity: "1" });
            stopRecording = host.keymap.record((got) => {
              if (got.error) return show(got.error);
              stopRecording = null;
              try {
                if (got.spec) host.keymap.set(k.id, got.spec);
                else if (got.clear) host.keymap.set(k.id, "");
              } catch (err) { console.warn("[deckit] could not set shortcut", err); }
              renderKeyboard();
            });
          });
          line.appendChild(key);

          const back = ui.miniBtn(ui.icon("reload", 13), `Back to ${k.defaultChord || "none"}`, () => {
            host.keymap.reset(k.id);
            renderKeyboard();
          });
          back.style.opacity = k.changed ? ".6" : "0";
          back.style.pointerEvents = k.changed ? "auto" : "none";
          line.appendChild(back);
          cellBox.appendChild(line);

          for (const issue of k.issues) {
            const note = document.createElement("div");
            note.textContent = issue.text;
            Object.assign(note.style, {
              font: "11.5px " + theme.font, lineHeight: "1.45", padding: "0 0 5px",
              color: issue.level === "error" ? ui.tone.alert : ui.tone.warn,
            });
            cellBox.appendChild(note);
          }
          grid.appendChild(cellBox);
        }
        keyboardRows.appendChild(group);
      }
    };

    const home = (p) => (p || "").replace(/^\/Users\/[^/]+/, "~");

    body.append(plugins, pluginSettings, urlSchemes, keyboard);
    content.append(head, body);

    const PARTS = [...body.children].filter((el) => el.heading).map((root) => ({ root, label: root.heading }));
    const sidebar = document.createElement("div");
    Object.assign(sidebar.style, { display: "flex", flexDirection: "column", minHeight: "0", flex: "1 1 auto" });
    const toc = ui.section("Table of Contents", { icon: ui.icon("tableOfContents", 16) });
    const tocList = ui.list();
    toc.body.appendChild(tocList);
    sidebar.appendChild(toc);

    let here = PARTS[0];
    const topOf = (part) => part.root.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
    // Redrawn rather than repainted: hoverable paints the active row only when it is built.
    const renderToc = () => {
      tocList.textContent = "";
      for (const part of PARTS) {
        const r = ui.row();
        const label = document.createElement("span");
        label.textContent = part.label;
        Object.assign(label.style, { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
        r.append(label);
        r.addEventListener("click", () => go(part));
        ui.hoverable(r, () => part === here);
        tocList.appendChild(r);
      }
    };

    // While gliding, the row stays on the destination: following the scroll would light every part passed.
    let gliding = false;
    let glideTimer = null;
    const landed = () => { gliding = false; clearTimeout(glideTimer); follow(); };
    const go = (part) => {
      here = part;
      renderToc();
      const top = Math.min(Math.max(0, topOf(part) - 4), body.scrollHeight - body.clientHeight);
      // Already there: nothing scrolls, so no scrollend would end the glide.
      if (Math.abs(top - body.scrollTop) < 1) return;
      gliding = true;
      clearTimeout(glideTimer);
      glideTimer = setTimeout(landed, 1500);
      body.scrollTo({ top, behavior: "smooth" });
    };
    body.addEventListener("scrollend", () => { if (gliding) landed(); });
    const follow = () => {
      if (gliding) return;
      // At the very bottom, the last part, which may be too short to ever reach the top.
      const atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
      const next = atEnd ? PARTS[PARTS.length - 1]
        : [...PARTS].reverse().find((p) => topOf(p) <= body.scrollTop + 48) || PARTS[0];
      if (next !== here) { here = next; renderToc(); }
    };
    body.addEventListener("scroll", follow, { passive: true });
    renderToc();

    // The card lights for a moment, since the cards around it look the same.
    const showCard = (id) => {
      renderPluginSettings();
      requestAnimationFrame(() => {
        const card = settingCards.get(id);
        if (!card) return;
        here = PARTS.find((p) => p.root === pluginSettings) || here;
        renderToc();
        gliding = true;
        clearTimeout(glideTimer);
        glideTimer = setTimeout(landed, 1500);
        const top = card.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8;
        body.scrollTo({ top: Math.min(Math.max(0, top), body.scrollHeight - body.clientHeight), behavior: "smooth" });
        card.style.background = ui.alpha(ui.accent, 0.12);
        setTimeout(() => { card.style.background = "transparent"; }, 1200);
      });
    };
    const showPart = (root) => {
      host.show();
      requestAnimationFrame(() => { const part = PARTS.find((p) => p.root === root); if (part) go(part); });
    };

    return {
      content, sidebar,
      didAppear: () => { renderPlugins(); renderPluginSettings(); renderURLSchemes(); renderKeyboard(); follow(); },
      didDisappear: () => { stopRecording?.(); stopRecording = null; },
      commands: () => {
        const PART_WORDS = new Map([
          [plugins, ["플러그인", "설치", "삭제", "plugins", "install", "remove"]],
          [pluginSettings, ["설정", "플러그인 설정", "settings", "preferences"]],
          [urlSchemes, ["열기", "링크", "파일 열기", "다음으로 열기", "스킴", "url scheme", "open with", "open link", "open file"]],
          [keyboard, ["단축키", "키맵", "키보드", "shortcuts", "keymap", "keyboard", "keys"]],
        ]);
        // Not host.plugins.running(): that asks every plugin for its commands, this one included.
        const icons = pluginIcons;
        const places = [
          ...[...PART_WORDS].map(([root, words]) => ({
            label: root.heading, icon: ui.icon("gear", 16),
            keywords: words, run: () => showPart(root),
          })),
          ...host.pluginSettings.list().map((g) => ({
            group: "Plugin Settings", label: g.name + " Settings", icon: icons.get(g.id) || ui.icon("sliders", 16),
            keywords: ["설정", "settings", g.id, ...g.items.map((it) => it.label)],
            run: () => { host.show(); showCard(g.id); },
          })),
        ];
        return places;
      },
    };
  },
});
