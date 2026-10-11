module.exports = ({ handle, files }) => {
    const fs = require('fs');
    const path = require('path');
    const { dialog, BrowserWindow } = require('electron');

    // Big enough for any source file, small enough that a log or a dump is not loaded by mistake.
    const LIMIT = 5 * 1024 * 1024;

    const absolute = (p) => {
        const s = String(p || '');
        if (!path.isAbsolute(s)) throw new Error('not an absolute path: ' + s);
        return s;
    };

    /* Every write is UTF-8, so a file in another encoding would come back with its bytes replaced.
     ignoreBOM keeps a byte order mark as a character, so writing the text back writes the mark. */
    const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    const decodeText = (buf) => {
        if (buf.includes(0)) return null;
        try {
            return UTF8.decode(buf);
        } catch {
            return null;
        }
    };

    // Asynchronous throughout: in the main process, a synchronous read stalls every window of the app.
    const fsp = fs.promises;

    // The kind leads the message: only the message crosses IPC, and the host reads it back as error.kind.
    const refusal = (kind, message) => new Error(`${kind}: ${message}`);
    handle('read', async (p) => {
        const file = absolute(p);
        let st;
        try {
            st = await fsp.stat(file);
        } catch {
            throw refusal('GONE', 'no such file');
        }
        if (!st.isFile()) throw refusal('NOT_TEXT', 'not a file');
        if (st.size > LIMIT)
            throw refusal('NOT_TEXT', `too big to open here (${Math.round(st.size / 1024 / 1024)} MB)`);
        const text = decodeText(await fsp.readFile(file));
        if (text === null) throw refusal('NOT_TEXT', 'not a UTF-8 text file');
        return { text, mtime: st.mtimeMs };
    });

    handle('stat', async (p) => {
        try {
            const st = await fsp.stat(absolute(p));
            return { exists: true, mtime: st.mtimeMs };
        } catch {
            return { exists: false, mtime: 0 };
        }
    });

    handle('write', async (p, text, seen) => {
        const file = absolute(p);
        if (seen != null) {
            let now = null;
            try {
                now = (await fsp.stat(file)).mtimeMs;
            } catch {}
            if (now !== null && Math.abs(now - seen) > 1)
                throw refusal('CHANGED', 'changed on disk since it was opened');
        }
        // In place, not a temp file and a rename: a rename breaks hard links and looks like a delete to watchers.
        await fsp.writeFile(file, String(text), 'utf8');
        return { mtime: (await fsp.stat(file)).mtimeMs };
    });

    handle('pick', async (what = 'file', suggested = '') => {
        const parent = BrowserWindow.getFocusedWindow() || undefined;
        if (what === 'save') {
            const r = await dialog.showSaveDialog(parent, {
                defaultPath: suggested || undefined,
                properties: ['createDirectory', 'showHiddenFiles'],
            });
            return r.canceled || !r.filePath ? [] : [r.filePath];
        }
        const properties =
            what === 'folder'
                ? ['openDirectory', 'createDirectory', 'showHiddenFiles']
                : ['openFile', 'multiSelections', 'showHiddenFiles'];
        const r = await dialog.showOpenDialog(parent, { properties });
        return r.canceled ? [] : r.filePaths;
    });

    handle('create', (dir) =>
        files.fresh(absolute(dir), 'untitled', (full) => fsp.writeFile(full, '', { flag: 'wx' }))
    );
    handle('mkdir', (dir) => files.fresh(absolute(dir), 'untitled folder', (full) => fsp.mkdir(full)));
    handle('rename', (p, name) => files.rename(absolute(p), name));
    handle('move', (p, dir) => files.move(absolute(p), absolute(dir)));
    handle('trash', async (p) => {
        await files.trash(absolute(p));
        return true;
    });

    const HIDDEN = new Set(['.git', '.DS_Store']);
    const HEAVY = new Set([
        '.git',
        'node_modules',
        '.build',
        'build',
        'DerivedData',
        'Pods',
        'Carthage',
        '.gradle',
        'dist',
        '.next',
        '.venv',
        'venv',
        '__pycache__',
        '.idea',
        '.swiftpm',
    ]);

    handle('list', async (dir) => {
        const at = absolute(dir);
        let listed;
        try {
            listed = await fsp.readdir(at, { withFileTypes: true });
        } catch (e) {
            throw /^(ENOENT|ENOTDIR)$/.test(e.code) ? refusal('GONE', 'that folder is no longer there') : e;
        }
        const entries = listed.filter((e) => !HIDDEN.has(e.name));
        const out = await Promise.all(
            entries.map(async (e) => {
                let folder = e.isDirectory();
                if (e.isSymbolicLink()) {
                    try {
                        folder = (await fsp.stat(path.join(at, e.name))).isDirectory();
                    } catch {
                        folder = false;
                    }
                }
                return { name: e.name, path: path.join(at, e.name), folder };
            })
        );
        return out.sort(
            (a, b) =>
                b.folder - a.folder || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
    });

    // An app started from the Dock has a bare PATH, so ripgrep is looked for at its usual paths.
    const rg = (() => {
        for (const p of ['/opt/homebrew/bin/rg', '/usr/local/bin/rg', '/usr/bin/rg']) {
            try {
                fs.accessSync(p, fs.constants.X_OK);
                return p;
            } catch {}
        }
        return null;
    })();
    const { spawn } = require('child_process');
    const run = (args, cwd, onLine, limitMs) => {
        let stop = () => {};
        const ended = new Promise((resolve, reject) => {
            const child = spawn(rg, args, { cwd });
            let rest = '';
            let stderr = '';
            let stopped = false;
            stop = () => {
                if (!stopped) {
                    stopped = true;
                    child.kill();
                }
            };
            const timer = setTimeout(stop, limitMs);
            child.stdout.on('data', (chunk) => {
                if (stopped) return;
                const lines = (rest + chunk).split('\n');
                rest = lines.pop();
                for (const line of lines) if (line && onLine(line) === false) return stop();
            });
            child.stderr.on('data', (chunk) => {
                if (stderr.length < 4096) stderr += chunk;
            });
            child.on('close', (code) => {
                clearTimeout(timer);
                resolve({ code, stderr: stderr.trim(), stopped });
            });
            child.on('error', (e) => {
                clearTimeout(timer);
                reject(new Error('could not run ripgrep: ' + e.message));
            });
        });
        ended.stop = () => stop();
        return ended;
    };
    // For a refused pattern the first line only says "regex parse error:"; the "error:" line has the detail.
    const complaint = (text) => {
        const lines = String(text || '')
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
        const said = lines.find((l) => /^error:/.test(l)) || lines[0] || '';
        return said.replace(/^(rg|error): /, '');
    };

    const walk = async function* (root) {
        const stack = [root];
        while (stack.length) {
            const dir = stack.pop();
            let entries = [];
            try {
                entries = await fs.promises.readdir(dir, { withFileTypes: true });
            } catch {
                continue;
            }
            for (const e of entries) {
                if (HEAVY.has(e.name) || e.name === '.DS_Store') continue;
                const p = path.join(dir, e.name);
                if (e.isDirectory()) stack.push(p);
                else if (e.isFile()) yield p;
            }
        }
    };
    const readable = async (p) => {
        try {
            const st = await fsp.stat(p);
            if (st.size > 1024 * 1024) return null;
            const text = decodeText(await fsp.readFile(p));
            return text === null ? null : { text, mtime: st.mtimeMs };
        } catch {
            return null;
        }
    };

    // Listing a big repository takes a moment, so the list is kept until the view asks for it `fresh`.
    const FILES_CAP = 300000;
    const fileLists = new Map(); // root -> Promise<{ files, truncated }>
    const listing = new Map(); // root -> the listing under way
    const listFiles = async (root) => {
        const files = [];
        let truncated = false;
        if (rg) {
            const globs = [...HEAVY].flatMap((h) => ['--glob', `!**/${h}/**`]);
            const r = await run(
                ['--files', '--hidden', ...globs],
                root,
                (line) => {
                    files.push(line);
                    return files.length < FILES_CAP;
                },
                30000
            );
            truncated = r.stopped;
            // 2 with nothing listed: the folder itself was refused (macOS privacy), not empty.
            if (!r.stopped && r.code === 2 && !files.length)
                throw new Error(complaint(r.stderr) || 'the folder could not be read');
        } else {
            for await (const p of walk(root)) {
                files.push(path.relative(root, p));
                if (files.length >= FILES_CAP) {
                    truncated = true;
                    break;
                }
            }
        }
        return { files: files.sort(), truncated };
    };
    // A fresh ask joins a listing under way: it started after whatever made the ask fresh.
    handle('files', (dir, { fresh = false } = {}) => {
        const root = absolute(dir);
        if (listing.has(root)) return listing.get(root);
        if (!fresh && fileLists.has(root)) return fileLists.get(root);
        const made = listFiles(root);
        fileLists.set(root, made);
        listing.set(root, made);
        made.then(
            () => listing.delete(root),
            () => {
                listing.delete(root);
                if (fileLists.get(root) === made) fileLists.delete(root);
            }
        );
        return made;
    });

    // Only for the walk without ripgrep: the two accept different patterns, so with ripgrep it judges.
    const patternOf = (query, { regex = false, caseSensitive = false, word = false } = {}) => {
        let src = regex ? String(query) : String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (word) src = `\\b(?:${src})\\b`;
        return new RegExp(src, caseSensitive ? 'g' : 'gi');
    };

    // A plain name matches anywhere, a path with a slash from the top, and anything with * ? [ { is a glob as written.
    const globsOf = (text) =>
        String(text || '')
            .split(',')
            .map((t) => t.trim().replace(/^\.\//, '').replace(/\/+$/, ''))
            .filter(Boolean)
            .flatMap((t) =>
                /[*?[{]/.test(t)
                    ? [t.includes('/') ? t : `**/${t}`]
                    : t.includes('/')
                      ? [t, `${t}/**`]
                      : [`**/${t}`, `**/${t}/**`]
            );
    // A character at a time, so an escaped character is itself and no rule's output is read by the next.
    const literal = (c) => c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const globRe = (g) => {
        let out = '';
        for (let i = 0; i < g.length; i++) {
            const c = g[i];
            if (c === '\\' && i + 1 < g.length) out += literal(g[++i]);
            else if (c === '*' && g[i + 1] === '*') {
                if (g[i + 2] === '/') {
                    out += '(?:.*/)?';
                    i += 2;
                } else {
                    out += '.*';
                    i += 1;
                }
            } else if (c === '*') out += '[^/]*';
            else if (c === '?') out += '[^/]';
            else if (c === '[') {
                const close = g.indexOf(']', i + 1);
                if (close < 0) {
                    out += '\\[';
                    continue;
                }
                const inner = g.slice(i + 1, close).replace(/^!/, '^');
                out += '[' + inner + ']';
                i = close;
            } else if (c === '{') {
                const close = g.indexOf('}', i + 1);
                if (close < 0) {
                    out += '\\{';
                    continue;
                }
                out +=
                    '(?:' +
                    g
                        .slice(i + 1, close)
                        .split(',')
                        .map((part) => globRe(part).source.slice(1, -1))
                        .join('|') +
                    ')';
                i = close;
            } else out += literal(c);
        }
        return new RegExp('^' + out + '$');
    };

    // Lines are 1-based, columns 0-based in characters.
    const MATCH_LIMIT = 5000;
    // The view only wants the newest answer, so a new search stops the one before it.
    const searches = new Map(); // root -> { stopped, stop() }
    handle('search', async (dir, query, opts = {}) => {
        const root = absolute(dir);
        searches.get(root)?.stop();
        if (!String(query || '')) return { files: [], total: 0, truncated: false, stoppedBy: '', warning: '' };
        const turn = {
            stopped: false,
            rg: null,
            stop() {
                this.stopped = true;
                this.rg?.stop();
            },
        };
        searches.set(root, turn);
        try {
            return await searchIn(root, query, opts, turn);
        } finally {
            if (searches.get(root) === turn) searches.delete(root);
        }
    });
    // A folder gone since it was picked is reported here only: refused when all are gone, a warning otherwise.
    const rootsOf = async (root, folders) => {
        const picked = [
            ...new Set(
                (Array.isArray(folders) ? folders : [])
                    .map((f) => String(f || '').replace(/^\/+|\/+$/g, ''))
                    .filter(Boolean)
            ),
        ].sort();
        const kept = picked.filter((f, i) => !picked.slice(0, i).some((o) => f.startsWith(o + '/')));
        const isDir = (p) =>
            fsp.stat(p).then(
                (st) => st.isDirectory(),
                () => false
            );
        const tops = [],
            gone = [];
        for (const f of kept.length ? kept : ['']) ((await isDir(path.join(root, f))) ? tops : gone).push(f);
        // A path is never the first word: it is shown as a sentence, which would capitalise it.
        const said = 'No longer there: ' + gone.join(', ');
        if (!tops.length) throw refusal('GONE', kept.length ? said : "The workspace's folder is no longer there");
        return { tops: tops.map((f) => path.join(root, f)), warning: gone.length ? said : '' };
    };
    const searchIn = async (root, query, opts, turn) => {
        const byFile = new Map();
        let total = 0;
        let stoppedBy = '';
        let warning = '';
        const add = (file, line, col, length, text) => {
            if (total >= MATCH_LIMIT) {
                stoppedBy = 'limit';
                return false;
            }
            if (!byFile.has(file)) byFile.set(file, []);
            byFile
                .get(file)
                .push({
                    line,
                    col,
                    length,
                    hit: text.slice(col, col + length),
                    text: text.length > 400 ? text.slice(0, 400) : text,
                });
            total += 1;
            return true;
        };
        const include = globsOf(opts.include);
        const exclude = globsOf(opts.exclude);
        // Each folder is searched from inside, so include and exclude read paths relative to it.
        const scope = await rootsOf(root, opts.folders);
        const tops = scope.tops;
        warning = scope.warning;
        // Taken when the search first reads a file: one changed during a long search must not pass as unchanged.
        const seen = new Map(); // file -> Promise of its mtime
        const stamp = (file) => {
            if (!seen.has(file))
                seen.set(
                    file,
                    fsp.stat(file).then(
                        (st) => st.mtimeMs,
                        () => 0
                    )
                );
        };
        const deadline = Date.now() + 20000;
        if (rg) {
            const args = [
                '--json',
                '--hidden',
                '--max-filesize',
                '1M',
                ...[...HEAVY].flatMap((h) => ['--glob', `!**/${h}/**`]),
            ];
            // A glob without ! is a whitelist to ripgrep: with any, only what they name is searched.
            for (const g of include) args.push('--glob', g);
            for (const g of exclude) args.push('--glob', '!' + g);
            args.push(opts.caseSensitive ? '-s' : '-i');
            if (opts.word) args.push('-w');
            if (!opts.regex) args.push('-F');
            args.push('-e', String(query), '--', '.');
            const unreadable = [];
            for (const top of tops) {
                if (turn.stopped || stoppedBy) break;
                const left = deadline - Date.now();
                if (left <= 0) {
                    stoppedBy = 'time';
                    break;
                }
                // ripgrep sums up a search it ran, and says nothing on stdout about one it refused to start.
                let searched = false;
                turn.rg = run(
                    args,
                    top,
                    (line) => {
                        let m;
                        try {
                            m = JSON.parse(line);
                        } catch {
                            return true;
                        }
                        if (m.type === 'summary') searched = true;
                        if (m.type !== 'match') return true;
                        // Not UTF-8: a file this editor does not open.
                        if (m.data.lines.bytes != null || m.data.path.bytes != null) return true;
                        const file = path.join(top, m.data.path.text || '');
                        stamp(file);
                        const text = String(m.data.lines.text || '').replace(/\r?\n$/, '');
                        const bytes = Buffer.from(text);
                        // ripgrep counts bytes; the editor counts characters.
                        const chars = (n) => bytes.subarray(0, n).toString('utf8').length;
                        for (const s of m.data.submatches || []) {
                            if (!add(file, m.data.line_number, chars(s.start), chars(s.end) - chars(s.start), text))
                                return false;
                        }
                        return true;
                    },
                    left
                );
                const r = await turn.rg;
                if (r.stopped && !stoppedBy && !turn.stopped) stoppedBy = 'time'; // out of time, not out of room
                /* 2 before any summary: ripgrep refused the pattern or a glob, as every folder would.
           2 after running: a file could not be read; what was found stands. */
                if (!r.stopped && r.code === 2) {
                    if (!searched) throw new Error(complaint(r.stderr) || 'the search could not run');
                    unreadable.push(complaint(r.stderr));
                }
            }
            /* ripgrep matches ASCII lines of other encodings and converts UTF-16; the editor opens neither.
         It also counts line 1 from after a byte order mark, which the editor keeps as a character. */
            for (const [file, matches] of [...byFile]) {
                const got = await readable(file);
                if (got === null) {
                    byFile.delete(file);
                    total -= matches.length;
                    continue;
                }
                if (got.text.charCodeAt(0) === 0xfeff)
                    for (const m of matches)
                        if (m.line === 1) {
                            m.col += 1;
                            m.text = '\uFEFF' + m.text;
                        }
            }
            if (unreadable.length)
                warning = [warning, 'Some files could not be read: ' + unreadable.join('; ')]
                    .filter(Boolean)
                    .join('. ');
        } else {
            const re = patternOf(query, opts);
            const ins = include.map(globRe),
                outs = exclude.map(globRe);
            const files = async function* () {
                for (const top of tops) for await (const file of walk(top)) yield [top, file];
            };
            scan: for await (const [top, file] of files()) {
                if (turn.stopped) break;
                if (Date.now() > deadline) {
                    stoppedBy = 'time';
                    break;
                }
                const inner = path.relative(top, file);
                if (ins.length && !ins.some((x) => x.test(inner))) continue;
                if (outs.some((x) => x.test(inner))) continue;
                const got = await readable(file);
                if (got == null) continue;
                const lines = got.text.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].replace(/\r$/, '');
                    re.lastIndex = 0;
                    let m;
                    while ((m = re.exec(line))) {
                        if (!m[0].length) {
                            re.lastIndex += 1;
                            continue;
                        }
                        if (!seen.has(file)) seen.set(file, Promise.resolve(got.mtime));
                        if (!add(file, i + 1, m.index, m[0].length, line)) break scan;
                    }
                }
            }
        }
        const files = await Promise.all(
            [...byFile].map(async ([p, matches]) => ({ path: p, matches, mtime: await seen.get(p) }))
        );
        files.sort((a, b) => a.path.localeCompare(b.path));
        return { files, total, truncated: !!stoppedBy, stoppedBy, warning };
    };
};
