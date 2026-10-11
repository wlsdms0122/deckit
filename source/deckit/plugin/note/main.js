module.exports = ({ data, handle, send, files }) => {
  const fs = require("fs");
  const fsp = fs.promises;
  const path = require("path");

  const ROOT = path.resolve(data);
  const EXT = ".md";
  const MAX_READ = 5 * 1024 * 1024;
  const MAX_DEPTH = 16;
  const BOM = "\uFEFF";
  // The kind is the message's first word: the view handles each kind differently.
  const fail = (kind, message) => new Error(kind + ": " + message);

  // The data folder also holds the plugin's settings JSON, so a note is decided by this rule alone.
  const visible = (name) => !name.startsWith(".");
  const isNote = (name) => visible(name) && name.toLowerCase().endsWith(EXT);

  // Created on every call: the folder may be deleted in Finder while the app runs.
  let realRoot = null;
  const ready = async () => {
    await fsp.mkdir(ROOT, { recursive: true });
    if (!realRoot) realRoot = await fsp.realpath(ROOT);
    return realRoot;
  };
  const relOf = (root, full) => path.relative(root, full).split(path.sep).join("/");

  // The nearest existing ancestor is resolved through links and must still be inside the root.
  const inside = async (rel) => {
    const root = await ready();
    const text = String(rel ?? "");
    const parts = text.split("/").filter(Boolean);
    if (path.isAbsolute(text) || text.includes("\\") || parts.some((p) => p === ".." || p === "." || !visible(p))) {
      throw fail("OUTSIDE", "not a place in the notes folder: " + text);
    }
    const full = path.join(root, ...parts);
    for (let probe = full; ;) {
      let real = null;
      try { real = await fsp.realpath(probe); } catch {}
      if (real) {
        if (real !== root && !real.startsWith(root + path.sep)) throw fail("OUTSIDE", "a link out of the notes folder: " + text);
        break;
      }
      const up = path.dirname(probe);
      if (up === probe) break;
      probe = up;
    }
    return { root, full };
  };
  const resolveNote = async (rel) => {
    const at = await inside(rel);
    if (at.full === at.root || !isNote(path.basename(at.full))) throw fail("NOT_NOTE", "not a note: " + rel);
    let st = null;
    try { st = await fsp.stat(at.full); } catch {}
    if (st && !st.isFile()) throw fail("NOT_NOTE", "not a note: " + rel);
    return at;
  };
  const resolveFolder = async (rel) => {
    const at = await inside(rel);
    let st = null;
    try { st = await fsp.stat(at.full); } catch {}
    if (!st) throw fail("GONE", "no such folder: " + rel);
    if (!st.isDirectory()) throw fail("NOT_FOLDER", "not a folder: " + rel);
    return at;
  };
  const resolveEntry = async (rel) => {
    const at = await inside(rel);
    if (at.full === at.root) throw fail("OUTSIDE", "the notes folder itself is not changed from here");
    let st = null;
    try { st = await fsp.lstat(at.full); } catch {}
    if (!st) throw fail("GONE", "no longer there: " + rel);
    if (!st.isDirectory() && !isNote(path.basename(at.full))) throw fail("NOT_NOTE", "not a note: " + rel);
    return { ...at, folder: st.isDirectory() };
  };

  const cleanName = (raw) => {
    const name = files.name(raw);
    if (!visible(name)) throw fail("NAME", `"${name}" cannot be a name: it would be hidden`);
    return name;
  };
  const exists = async (p) => { try { await fsp.lstat(p); return true; } catch { return false; } };

  const previewOf = (text, name) => {
    // Fence and rule lines are dropped before marks are stripped, or "```shell" would leave "shell".
    const lines = text.split(/\r?\n/).filter((l) => !/^\s*(-{3,}|`{3,}.*|~{3,}.*)\s*$/.test(l)).map((l) => l
      .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_~`]+/g, "").trim())
      .filter((l) => l);
    if (lines.length && lines[0].toLowerCase() === name.toLowerCase()) lines.shift();
    return lines.join(" ").slice(0, 200);
  };
  /* Named by inode as well as name: a note written in place keeps its inode, so the backup follows
     a rename here, and one left by a rename elsewhere never attaches to a new note of that name. */
  const backupOf = (full, ino) => path.join(path.dirname(full), `.${path.basename(full)}.${ino}.deckit-backup`);
  const readText = async (full) => {
    let st;
    try { st = await fsp.stat(full); } catch (e) { if (e.code === "ENOENT") throw fail("GONE", "the note is no longer there"); throw e; }
    if (st.size > MAX_READ) throw fail("TOO_BIG", "this note is larger than 5 MB");
    const torn = await exists(backupOf(full, st.ino));
    const buf = await fsp.readFile(full);
    let text;
    /* The view edits "\n" text without a byte-order mark; both are put back on write. CRLF only when
       every break is one, so mixed endings are written back as "\n". `torn`: a backup from a save
       that stopped partway exists. A torn file may be cut inside a character, so it decodes leniently.
       ignoreBOM keeps the mark in the text so it is detected below. */
    try { text = new TextDecoder("utf-8", { fatal: !torn, ignoreBOM: true }).decode(buf); }
    catch { throw fail("NOT_TEXT", "this file is not UTF-8 text"); }
    const bom = text.startsWith(BOM);
    if (bom) text = text.slice(1);
    const crlf = /\r\n/.test(text) && !/(^|[^\r])\n/.test(text) && !/\r(?!\n)/.test(text);
    return { text: text.replace(/\r\n?/g, "\n"), mtime: st.mtimeMs, birth: st.birthtimeMs, bom, eol: crlf ? "\r\n" : "\n", torn };
  };

  // Symbolic links are not followed: a Dirent reports a link as neither a folder nor a file.
  const walk = async (dir, depth, visit) => {
    let entries = [];
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!visible(e.name)) continue;
      const full = path.join(dir, e.name);
      const kind = e.isDirectory() && depth < MAX_DEPTH ? "folder" : e.isFile() && isNote(e.name) ? "note" : null;
      if (!kind) continue;
      const said = await visit(full, e, kind);
      if (said === "stop") return "stop";
      if (kind === "folder" && said !== "skip" && (await walk(full, depth + 1, visit)) === "stop") return "stop";
    }
  };

  handle("root", async () => ({ root: await ready() }));

  handle("tree", async () => {
    const root = await ready();
    const top = { name: "", rel: "", folders: [], notes: [], count: 0 };
    const byPath = new Map([[root, top]]);
    await walk(root, 0, async (full, e, kind) => {
      const parent = byPath.get(path.dirname(full));
      if (kind === "note") {
        let mtime = 0;
        try { mtime = (await fsp.stat(full)).mtimeMs; } catch {}
        parent.notes.push({ name: e.name.slice(0, -EXT.length), rel: relOf(root, full), mtime });
        parent.count++;
        return;
      }
      const node = { name: e.name, rel: relOf(root, full), folders: [], notes: [], count: 0 };
      parent.folders.push(node);
      byPath.set(full, node);
    });
    const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    const sort = (node) => { node.folders.sort(byName); node.notes.sort(byName); node.folders.forEach(sort); };
    sort(top);
    return top;
  });

  handle("list", async (rel) => {
    const { root, full: dir } = await resolveFolder(rel);
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const notes = [];
    for (const e of entries) {
      if (!e.isFile() || !isNote(e.name)) continue;
      const full = path.join(dir, e.name);
      const name = e.name.slice(0, -EXT.length);
      try {
        const st = await fsp.stat(full);
        const fh = await fsp.open(full, "r");
        let head = "";
        try { const { buffer, bytesRead } = await fh.read(Buffer.alloc(4096), 0, 4096, 0); head = buffer.subarray(0, bytesRead).toString("utf8"); }
        finally { await fh.close(); }
        notes.push({ name, rel: relOf(root, full), mtime: st.mtimeMs, birth: st.birthtimeMs, preview: previewOf(head.startsWith(BOM) ? head.slice(1) : head, name) });
      } catch { /* gone between readdir and stat */ }
    }
    return notes;
  });

  handle("read", async (rel) => readText((await resolveNote(rel)).full));

  // Modification times of the plugin's own writes, so the watcher does not report a save as an outside change.
  const written = new Map();

  // writeFile, not write: on a full disk write can return a short count instead of failing.
  const putInPlace = async (fh, bytes) => {
    await fh.truncate(0);
    await fh.writeFile(bytes);
    await fh.sync();
  };
  /* Written in place so the file keeps its creation date, Finder tags and links. A write cut off
     halfway would leave the note truncated, so the old version is first copied beside it and
     flushed, and removed once the new text is down. An existing backup is the last whole version
     from a failed save and is never overwritten. */
  handle("write", async (rel, text, base, { bom = false, eol = "\n" } = {}) => {
    const { full, root } = await resolveNote(rel);
    let st = null;
    try { st = await fsp.stat(full); } catch {}
    if (base != null) {
      if (!st) throw fail("GONE", "the note is no longer there");
      if (Math.abs(st.mtimeMs - base) > 1) throw fail("CHANGED", "the note was changed somewhere else");
    }
    let out = String(text);
    if (eol === "\r\n") out = out.replace(/\r?\n/g, "\r\n");
    if (bom) out = BOM + out;
    // Opened first, so a locked or read-only note fails with nothing touched.
    const fh = await fsp.open(full, st ? "r+" : "wx");
    try {
      const backup = st && backupOf(full, st.ino);
      if (backup && !(await exists(backup))) {
        try {
          const copy = await fsp.open(backup, "w");
          try { await copy.writeFile(await fsp.readFile(full)); await copy.sync(); } finally { await copy.close(); }
        } catch (e) {
          await fsp.unlink(backup).catch(() => {});
          throw fail("NO_ROOM", `the note was not changed: there is no room to keep its last version while saving (${e.code || e.message})`);
        }
      }
      try { await putInPlace(fh, Buffer.from(out, "utf8")); }
      catch (e) {
        // TORN only when a backup exists to go back to. A file this write created (wx) is removed.
        if (backup) throw fail("TORN", `saving stopped partway (${e.code || e.message})`);
        if (!st) await fsp.unlink(full).catch(() => {});
        throw e;
      }
      if (backup) await fsp.unlink(backup).catch(() => {});
    } finally { await fh.close().catch(() => {}); }
    const mtime = (await fsp.stat(full)).mtimeMs;
    written.set(relOf(root, full), mtime);
    return { mtime };
  });

  handle("restore", async (rel) => {
    const { full, root } = await resolveNote(rel);
    const st = await fsp.stat(full).catch(() => null);
    const backup = st && backupOf(full, st.ino);
    if (!backup || !(await exists(backup))) throw fail("GONE", "there is no earlier version kept for this note");
    const fh = await fsp.open(full, "r+");
    try { await putInPlace(fh, await fsp.readFile(backup)); }
    catch (e) { throw fail("TORN", `restoring stopped partway (${e.code || e.message})`); }
    finally { await fh.close().catch(() => {}); }
    await fsp.unlink(backup).catch(() => {});
    const mtime = (await fsp.stat(full)).mtimeMs;
    written.set(relOf(root, full), mtime);
    return { mtime };
  });
  // The backup is named after the note, so it must be moved with it or the note stops being torn.
  const carryBackup = async (from, to) => {
    const st = await fsp.stat(to).catch(() => null);
    if (st && (await exists(backupOf(from, st.ino)))) await fsp.rename(backupOf(from, st.ino), backupOf(to, st.ino));
  };

  handle("create", async (folder) => {
    const { root, full: dir } = await resolveFolder(folder);
    const full = await files.fresh(dir, "Untitled", (f) => fsp.writeFile(f, "", { encoding: "utf8", flag: "wx" }), EXT);
    const st = await fsp.stat(full);
    written.set(relOf(root, full), st.mtimeMs);
    return { rel: relOf(root, full), name: path.basename(full, EXT), mtime: st.mtimeMs };
  });

  handle("mkdir", async (parent, name) => {
    const { root, full: dir } = await resolveFolder(parent);
    const full = await files.fresh(dir, name ? cleanName(name) : "New Folder", (f) => fsp.mkdir(f));
    return { rel: relOf(root, full), name: path.basename(full) };
  });

  handle("rename", async (rel, name) => {
    const { root, full: from, folder } = await resolveEntry(rel);
    const to = await files.rename(from, cleanName(name) + (folder ? "" : EXT));
    if (!folder && to !== from) await carryBackup(from, to);
    return { rel: relOf(root, to) };
  });

  handle("move", async (rel, folder) => {
    const { root, full: from, folder: isFolder } = await resolveEntry(rel);
    const { full: dir } = await resolveFolder(folder);
    const to = await files.move(from, dir);
    if (!isFolder && to !== from) await carryBackup(from, to);
    return { rel: relOf(root, to) };
  });

  handle("discard", async (rel) => {
    const { full } = await resolveNote(rel);
    try { const st = await fsp.stat(full); if (!st.isFile() || st.size > 0) return false; } catch { return false; }
    await fsp.unlink(full);
    return true;
  });

  handle("trash", async (rel) => {
    const { full, folder } = await resolveEntry(rel);
    const st = folder ? null : await fsp.stat(full).catch(() => null);
    await files.trash(full);
    if (st && (await exists(backupOf(full, st.ino)))) await files.trash(backupOf(full, st.ino)).catch(() => {});
    return true;
  });

  handle("search", async (query) => {
    const root = await ready();
    const words = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return { hits: [], partial: false };
    const hits = [];
    let seen = 0, partial = false;
    await walk(root, 0, async (full, e, kind) => {
      if (kind !== "note") return;
      if (++seen > 5000) { partial = true; return "stop"; }
      const name = e.name.slice(0, -EXT.length);
      let got;
      try { got = await readText(full); } catch { return; }
      const lowName = name.toLowerCase(), lowText = got.text.toLowerCase();
      if (!words.every((w) => lowName.includes(w) || lowText.includes(w))) return;
      const flat = got.text.replace(/\s+/g, " ");
      const at = Math.min(...words.map((w) => flat.toLowerCase().indexOf(w)).filter((i) => i >= 0), Infinity);
      const snippet = !Number.isFinite(at) || at < 40 ? previewOf(got.text, name) : "…" + flat.slice(at - 30, at + 130);
      hits.push({ rel: relOf(root, full), name, mtime: got.mtime, inName: words.every((w) => lowName.includes(w)), snippet });
    });
    hits.sort((a, b) => (b.inName - a.inName) || (b.mtime - a.mtime));
    return { hits: hits.slice(0, 200), partial: partial || hits.length > 200 };
  });

  /* Asked as a state (on or off), not a subscription, so a page reloaded without unsubscribing
     leaves no second watcher. `watchAsked` makes the last request win across the await in ready(). */
  let watcher = null, pending = new Set(), timer = null, watchAsked = 0;
  const stopWatching = () => { if (watcher) { watcher.close(); watcher = null; } };
  const flush = async () => {
    const root = await ready();
    const changed = [];
    for (const rel of pending) {
      let st = null;
      try { st = await fsp.stat(path.join(root, ...rel.split("/"))); } catch {}
      // A path that is gone is reported: it may have been a note or a folder.
      if (st && !st.isDirectory() && !isNote(path.basename(rel))) continue;
      const own = written.get(rel);
      if (st && own != null && Math.abs(st.mtimeMs - own) <= 1) continue;
      changed.push(rel);
    }
    pending = new Set();
    if (changed.length) send("changed", changed);
  };
  handle("watch", async (on) => {
    const mine = ++watchAsked;
    stopWatching();
    if (!on) return false;
    const root = await ready();
    if (mine !== watchAsked) return false;
    stopWatching();
    try {
      watcher = fs.watch(root, { recursive: true }, (_, file) => {
        const rel = String(file || "").split(path.sep).join("/");
        if (!rel || rel.split("/").some((p) => !visible(p))) return;
        pending.add(rel);
        clearTimeout(timer);
        timer = setTimeout(() => { flush().catch(() => {}); }, 250);
      });
      watcher.on("error", () => { watcher?.close(); watcher = null; });
    } catch { watcher = null; }
    return !!watcher;
  });
};
