const folderSearch = ({ theme, ui, main, root, folders, ranker, onOpen, onReplaceAll }) => {
  const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
  // `head` stays put and `element` scrolls under it, so the field never scrolls away with its results.
  const head = el("div", { display: "flex", flexDirection: "column", gap: "6px", minWidth: "0", padding: "2px 0 6px" });
  const element = el("div", { display: "flex", flexDirection: "column", minWidth: "0", padding: "0 0 8px" });

  let opts = { caseSensitive: false, word: false, regex: false };
  let query = "";
  let timer = null;
  const bar = ui.searchBar({
    placeholder: "Find in workspace",
    replace: { onReplaceAll: () => askReplace() },
    onChange: (s) => {
      query = s.query;
      opts = { caseSensitive: s.caseSensitive, word: s.word, regex: s.regex };
      clearTimeout(timer);
      timer = setTimeout(run, 250);
    },
  });

  const scope = { include: "", exclude: "", folders: [] };
  const rescope = () => { clearTimeout(timer); timer = setTimeout(run, 250); paintFilter(); };
  const includeField = ui.field({ placeholder: "Files to include", size: "sm", icon: ui.icon("fileText", 13), clearable: true,
    onInput: (v) => { scope.include = v; rescope(); }, onEnter: () => run() });
  const excludeField = ui.field({ placeholder: "Files to exclude", size: "sm", icon: ui.icon("x", 13), clearable: true,
    onInput: (v) => { scope.exclude = v; rescope(); }, onEnter: () => run() });
  // Ranked in a worker: a repository has thousands of folders.
  const folderPick = ui.suggestions({ onPick: (it) => { folderField.setValue(""); setFolders([...scope.folders, it.rel]); } });
  const folderRanker = ranker({ paths: true });
  const SUGGESTED = 12;
  let suggesting = 0;
  const suggest = async () => {
    const q = folderField.input.value.trim(), mine = ++suggesting;
    if (!q) return folderPick.close();
    let found = [];
    // Picked folders are left out after ranking, so the list the worker holds stays the same and only the query travels.
    try {
      const ranked = await folderRanker.rank(await folders(), q, { limit: SUGGESTED + scope.folders.length });
      if (!ranked) return;
      found = ranked.filter((rel) => !scope.folders.includes(rel)).slice(0, SUGGESTED);
    } catch {}
    if (mine !== suggesting || document.activeElement !== folderField.input) return;
    if (!found.length) return folderPick.close();
    folderPick.show(found.map((rel) => ({
      rel, label: rel.split("/").pop(), hint: rel.split("/").slice(0, -1).join("/"), icon: ui.folderIcon(false, 14),
    })), folderField.getBoundingClientRect());
  };
  const folderField = ui.field({ placeholder: "In folder", size: "sm", icon: ui.icon("folder", 13), clearable: true, onInput: () => suggest() });
  folderField.input.addEventListener("keydown", (e) => {
    if (!folderPick.open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") folderPick.step(e.key === "ArrowDown" ? 1 : -1);
    else if (e.key === "Enter") folderPick.take();
    else if (e.key === "Escape") folderPick.close();
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  folderField.input.addEventListener("blur", () => { suggesting++; folderPick.close(); });
  // INSET lines the fields up under the find field's text.
  const INSET = 26, EDGE = 2;
  const scopeRows = el("div", { display: "none", flexDirection: "column", gap: "4px", paddingLeft: INSET + "px" });
  const patternRows = el("div", { display: "flex", flexDirection: "column", gap: "4px" });
  patternRows.append(includeField, excludeField);
  scopeRows.append(patternRows, el("div", { height: "6px" }), folderField);
  const filter = ui.toggleButton(ui.icon("filter", 13), "Where to search", {
    onChange: (on) => {
      scopeRows.style.display = on ? "flex" : "none";
      folderLine.style.paddingLeft = (on ? INSET + EDGE : EDGE) + "px";
      if (on) includeField.input.focus();
    },
  });
  // Marked while any scope is set, even folded away, so a narrowed search never passes for the whole workspace.
  const paintFilter = () => filter.setMarked(!!(scope.include.trim() || scope.exclude.trim() || scope.folders.length));
  /* Folders are kept out of the include field: there a top-level name would match every folder of
     that name, and a comma or a bracket in a path would be read as syntax. */
  const folderLine = el("div", { display: "none", alignItems: "flex-start", gap: "6px", padding: `0 0 0 ${EDGE}px`, font: "12px " + theme.font, minWidth: "0" });
  const folderGlyph = el("span", { display: "flex", flex: "0 0 auto", opacity: ".6", paddingTop: "3px" });
  folderGlyph.innerHTML = ui.folderIcon(false, 12);
  const folderChips = el("div", { flex: "1 1 auto", minWidth: "0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 4px" });
  const folderClear = ui.miniBtn(ui.icon("x", 12), "Search the whole workspace", () => setFolders([]));
  folderClear.style.opacity = ".7";
  folderLine.append(folderGlyph, folderChips, folderClear);
  const chip = (rel) => {
    const c = el("span", { display: "inline-flex", alignItems: "center", gap: "2px", maxWidth: "100%", minWidth: "0",
      padding: "1px 2px 1px 6px", borderRadius: "5px", background: ui.wash.hover });
    const name = el("span", { minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
    name.textContent = rel;
    c.title = rel;
    const off = ui.miniBtn(ui.icon("x", 10), "Not in " + rel, () => setFolders(scope.folders.filter((f) => f !== rel)));
    off.style.opacity = ".7";
    c.append(name, off);
    return c;
  };
  const setFolders = (list) => {
    scope.folders = [...new Set(list.filter(Boolean))];
    folderChips.textContent = "";
    const lead = el("span", { opacity: ".6", whiteSpace: "nowrap" });
    lead.textContent = "Only in";
    folderChips.append(lead, ...scope.folders.map(chip));
    // A single folder is cleared by its own ×.
    folderClear.style.display = scope.folders.length > 1 ? "" : "none";
    folderLine.style.display = scope.folders.length ? "flex" : "none";
    rescope();
  };

  const summaryText = el("span", { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
  const summary = el("div", { display: "flex", alignItems: "center", gap: "6px", font: "12px " + theme.font, minHeight: "20px", padding: "0 0 0 2px" });
  summaryText.style.opacity = ".5";
  summary.append(summaryText, filter);
  const warningLine = el("div", { display: "none", font: "11.5px " + theme.font, opacity: ".55", padding: "0 0 0 2px", lineHeight: "1.4" });
  const results = el("div", { display: "flex", flexDirection: "column", minWidth: "0" });
  head.append(bar, scopeRows, folderLine, summary, warningLine);
  element.append(results);

  let last = null;   // the last answer, which Replace all acts on
  let seq = 0;
  let running = false;
  const collapsed = new Set();
  const rel = (p) => { const r = root(); return r && p.startsWith(r + "/") ? p.slice(r.length + 1) : p; };

  const fileRow = (f) => {
    const head = ui.row({ dense: true });
    head.style.padding = "0 6px 0 2px";
    const caret = el("span", {
      display: "flex", flex: "0 0 12px", opacity: ".5",
      transform: collapsed.has(f.path) ? "none" : "rotate(90deg)", transition: `transform ${ui.motion.fast} ${ui.motion.ease}`,
    });
    caret.innerHTML = ui.icon("chevronRight", 12);
    const glyph = el("span", { display: "flex", flex: "0 0 auto" });
    glyph.innerHTML = fileIcons.file(f.path.split("/").pop(), 13);
    const name = el("span", { flex: "0 1 auto", minWidth: "40px", maxWidth: "75%", overflow: "hidden", textOverflow: "ellipsis", fontWeight: "600" }, f.path.split("/").pop());
    const dir = el("span", { flex: "1 1 0", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", opacity: ".45", fontSize: "12px" }, rel(f.path).split("/").slice(0, -1).join("/"));
    const n = el("span", { flex: "0 0 auto", minWidth: "18px", padding: "0 5px", borderRadius: "999px", background: "rgba(128,128,128,.18)", font: "600 11px " + theme.font, textAlign: "center", fontVariantNumeric: "tabular-nums" }, String(f.matches.length));
    head.append(caret, glyph, name, dir, n);
    head.title = f.path;
    ui.hoverable(head);
    head.addEventListener("click", () => { if (collapsed.has(f.path)) collapsed.delete(f.path); else collapsed.add(f.path); render(); });
    return head;
  };
  const matchRow = (f, m) => {
    const line = ui.row({ dense: true });
    Object.assign(line.style, { padding: "0 6px 0 22px", font: "12px " + MONO, overflow: "hidden" });
    const no = el("span", { flex: "0 0 auto", opacity: ".4", minWidth: "22px", textAlign: "right" }, String(m.line));
    // Twelve characters of context, so the match stays in view.
    const from = Math.max(0, m.col - 12);
    const lead = (from ? "…" : "") + m.text.slice(from, m.col).replace(/^\s+/, "");
    const text = el("span", { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis" });
    const hit = el("span", { background: ui.alpha("#ecb22e", 0.35), borderRadius: "2px" }, m.text.slice(m.col, m.col + m.length));
    text.append(document.createTextNode(lead), hit, document.createTextNode(m.text.slice(m.col + m.length)));
    line.append(no, text);
    ui.hoverable(line);
    line.addEventListener("click", () => onOpen(f.path, m));
    return line;
  };
  // In steps: thousands of rows can land while the next words are typed, and must not hold them up.
  const render = () => {
    const rows = [];
    for (const f of last?.files || []) {
      rows.push({ f });
      if (!collapsed.has(f.path)) for (const m of f.matches) rows.push({ f, m });
    }
    ui.drawInSteps(results, rows, ({ f, m }) => (m ? matchRow(f, m) : fileRow(f)));
  };

  const run = async () => {
    clearTimeout(timer);
    timer = null;
    const r = root();
    const q = query;
    const mine = ++seq;
    warningLine.style.display = "none";
    if (!r || !q) { running = false; last = null; summaryText.textContent = r ? "" : "Open a folder to search it"; render(); return; }
    running = true;
    summaryText.textContent = "Searching…";
    let got;
    try { got = await main.call("search", r, q, { ...opts, ...scope }); }
    catch (e) {
      if (mine !== seq) return;
      running = false;
      last = null; render();
      const { kind, message } = failureOf(e);
      // A GONE message from main is already a sentence naming the folders.
      summaryText.textContent = kind === "GONE" ? message : "Could not search: " + message;
      return;
    }
    if (mine !== seq) return;
    running = false;
    last = { ...got, query: q, opts: { ...opts } };
    const files = got.files.length;
    // Out of time with nothing found is not "No results", which would read as "nothing uses this".
    summaryText.textContent = got.total
      ? `${got.total}${got.truncated ? "+" : ""} result${got.total === 1 ? "" : "s"} in ${files} file${files === 1 ? "" : "s"}`
      : got.stoppedBy === "time" ? "Stopped before finding anything: it took too long. Narrow it with the files to include."
        : "No results";
    warningLine.textContent = got.warning || "";
    warningLine.style.display = got.warning ? "block" : "none";
    render();
  };

  /* Only on complete results for the field as it is: while a search is pending, `last` is the
     previous query's, and a capped answer lists fewer matches than there are. */
  const askReplace = () => {
    const say = (title, message) => ui.dialog({ title, message, confirmLabel: "OK" });
    if (timer || running) return say("The search is still running", "Replace all works on the results listed, so it waits until they are in.");
    if (!last || !last.total) return;
    if (last.truncated) {
      return say("Too many results to replace at once",
        `The search stopped at ${last.total} results, so it does not list every match. Narrow it with the files to include or exclude, then replace.`);
    }
    const files = last.files.length;
    const value = bar.replacement;
    const answer = last;
    ui.dialog({
      title: "Replace all?",
      message: `${answer.total} match${answer.total === 1 ? "" : "es"} in ${files} file${files === 1 ? "" : "s"} will be replaced with “${value}”. ` +
        "Files open here with unsaved changes are left out; save them and search again to include them. A file or a match that changed since the search is left as it is.",
      confirmLabel: "Replace", cancelLabel: "Cancel", destructive: true,
      onConfirm: async () => {
        const done = await onReplaceAll(answer.files, { query: answer.query, replacement: value, opts: answer.opts });
        await run();
        if (done && done.skipped) {
          say(`${done.skipped} match${done.skipped === 1 ? " was" : "es were"} not replaced`,
            `${done.replaced} replaced. The rest were skipped because ${done.why}.`);
        }
      },
    });
  };
  return {
    head,
    element,
    focus(text) {
      if (text) { bar.setQuery(text); query = text; }
      bar.focus();
      if (text) run();
    },
    within(rel) {
      setFolders([rel]);
      bar.focus();
    },
    follow(move) {
      const top = root();
      if (!scope.folders.length || !top) return;
      const base = move(top) || top;
      const now = scope.folders.map((rel) => {
        const at = move(top + "/" + rel);
        return at && at.startsWith(base + "/") ? at.slice(base.length + 1) : "";
      });
      if (now.every((rel, i) => rel === scope.folders[i])) return;
      setFolders(now);
    },
    close() {
      folderRanker.close();
    },
  };
};
