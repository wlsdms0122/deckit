DeckitModule.define(
    'deckit/service/plugin/model/manifest',
    {
        uses: ['deckit/service/storage/model/space', 'deckit/service/open/model/scheme'],
        provides: [
            'FILE',
            'parse',
            'read',
            'idProblem',
            'RESERVED_ID',
            'MAIN_PERMISSION',
            'HOST_API',
            'satisfies',
            'apiProblem',
        ],
        runs: 'any',
    },
    (SPACE, SCHEMES) => {
        const FILE = 'manifest.toml';
        const KEY = /^(?:[A-Za-z0-9_-]+|"(?:[^"\\]|\\.)*")$/;

        const unquote = (raw, line) => {
            if (raw.startsWith("'")) return raw.slice(1, -1);
            return raw.slice(1, -1).replace(/\\(u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|.)/g, (all, e) => {
                if (e[0] === 'u' || e[0] === 'U') return String.fromCodePoint(parseInt(e.slice(1), 16));
                const plain = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\' }[e];
                if (plain === undefined) throw new Error(`line ${line}: unknown escape \\${e}`);
                return plain;
            });
        };

        const value = (text, line) => {
            const s = text.trimStart();
            let m;
            if ((m = /^"(?:[^"\\]|\\.)*"/.exec(s)) || (m = /^'[^']*'/.exec(s)))
                return [unquote(m[0], line), s.slice(m[0].length)];
            if ((m = /^(true|false)\b/.exec(s))) return [m[1] === 'true', s.slice(m[0].length)];
            if ((m = /^[+-]?\d+(?![\w.])/.exec(s))) return [Number(m[0]), s.slice(m[0].length)];
            if (s.startsWith('[')) {
                const out = [];
                let rest = s.slice(1).trimStart();
                while (!rest.startsWith(']')) {
                    const [v, after] = value(rest, line);
                    out.push(v);
                    rest = after.trimStart();
                    if (rest.startsWith(',')) rest = rest.slice(1).trimStart();
                    else if (!rest.startsWith(']')) throw new Error(`line ${line}: expected , or ] in an array`);
                }
                return [out, rest.slice(1)];
            }
            throw new Error(`line ${line}: not a value this manifest reads: ${s.split('\n')[0].slice(0, 40)}`);
        };

        /* Visits each character outside a string: a basic string takes backslash escapes, a literal one
     does not. `visit` returning true stops the walk and returns that index. */
        const outsideStrings = (text, visit) => {
            let quote = null;
            for (let i = 0; i < text.length; i++) {
                const c = text[i];
                if (quote) {
                    if (c === '\\' && quote === '"') i++;
                    else if (c === quote) quote = null;
                } else if (c === '"' || c === "'") quote = c;
                else if (visit(c, i)) return i;
            }
            return -1;
        };
        const withoutComment = (text) => {
            const at = outsideStrings(text, (c) => c === '#');
            return at < 0 ? text : text.slice(0, at);
        };
        const bracketDepth = (text) => {
            let depth = 0;
            outsideStrings(text, (c) => {
                if (c === '[') depth++;
                else if (c === ']') depth--;
                return false;
            });
            return depth;
        };

        // As a key or a table these would reach the prototype instead of being a field.
        const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);

        // No prototype, so a lookup finds only what the manifest said.
        const bare = () => Object.create(null);

        const parse = (text) => {
            const out = bare();
            let table = out;
            const lines = String(text).replace(/^﻿/, '').split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                const at = i + 1;
                let body = withoutComment(lines[i]).trim();
                if (!body) continue;
                const head = /^\[([A-Za-z0-9_-]+)\]$/.exec(body);
                if (head) {
                    if (UNSAFE.has(head[1]))
                        throw new Error(`line ${at}: [${head[1]}] is not a table name a manifest can use`);
                    if (Object.prototype.hasOwnProperty.call(out, head[1]))
                        throw new Error(`line ${at}: [${head[1]}] appears twice`);
                    table = out[head[1]] = bare();
                    continue;
                }
                const eq = body.indexOf('=');
                if (eq < 0) throw new Error(`line ${at}: expected key = value`);
                const rawKey = body.slice(0, eq).trim();
                // TOML reads a bare dotted key as a table inside a table; a dotted permission name must be quoted.
                if (/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/.test(rawKey))
                    throw new Error(`line ${at}: a name with a dot is written in quotes: "${rawKey}" = …`);
                if (!KEY.test(rawKey)) throw new Error(`line ${at}: not a key this manifest reads: ${rawKey}`);
                const key = rawKey.startsWith('"') ? unquote(rawKey, at) : rawKey;
                if (UNSAFE.has(key)) throw new Error(`line ${at}: ${key} is not a key a manifest can use`);
                if (Object.prototype.hasOwnProperty.call(table, key))
                    throw new Error(`line ${at}: ${key} is set twice`);
                let rest = body.slice(eq + 1);
                let depth = bracketDepth(rest);
                while (depth > 0 && i + 1 < lines.length) {
                    i++;
                    const more = withoutComment(lines[i]);
                    depth += bracketDepth(more);
                    rest += '\n' + more;
                }
                const [v, after] = value(rest, at);
                if (after.trim()) throw new Error(`line ${at}: unexpected text after the value of ${key}`);
                table[key] = v;
            }
            return out;
        };

        const RESERVED_ID = SPACE.RESERVED;
        const idProblem = (raw) => {
            const id = String(raw == null ? '' : raw);
            const why = SPACE.nameProblem(id);
            if (why) return why;
            // macOS disks ignore case, so "Host" and "host" would be one folder while comparing as two ids.
            if (id !== id.toLowerCase()) return `plugin ids are lower case: "${id.toLowerCase()}", not "${id}"`;
            if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id) || id.includes('..')) {
                return `"${id}" is not a usable plugin id: lower case letters, digits, . _ - and at most 64 of them`;
            }
            return '';
        };

        /* In the order Settings lists them, the widest first. A Map so that a name like "constructor" is
     unknown rather than found on a prototype. */
        const PERMISSIONS = new Map([
            [
                'system.main-process',
                {
                    label: 'Main Process',
                    means: "Its main.js runs in the app's main process, outside the panel, where code can read and write your files, reach the network and start programs.",
                },
            ],
            [
                'system.files',
                {
                    label: 'Files',
                    means: 'It can open files on this Mac in its own pages, where it can read what they hold.',
                },
            ],
            [
                'system.network',
                {
                    label: 'Network',
                    means: 'It can read any address on the web or your network, past the rules that keep one site from reading another.',
                },
            ],
            [
                'system.certificates',
                {
                    label: 'Certificates',
                    means: "It can accept a certificate this Mac cannot verify, for one site, so that site's pages load.",
                },
            ],
            [
                'system.site-permissions',
                {
                    label: 'Site Permissions',
                    means: "It can let a site's pages use the camera, the microphone, notices and the rest a page asks for, and take that back.",
                },
            ],
            [
                'system.clipboard',
                {
                    label: 'Clipboard',
                    means: 'It can read what you copied, from any app. Copying text needs no permission.',
                },
            ],
            [
                'system.notifications',
                {
                    label: 'Notifications',
                    means: 'It can show notices in the corner of the screen, while you are looking at something else.',
                },
            ],
            [
                'system.global-keys',
                {
                    label: 'Keys Everywhere',
                    means: 'Its keys work wherever you are in the app, with the panel closed too, and are taken from every page there.',
                },
            ],
            [
                'deckit.plugins',
                {
                    label: 'Plugins',
                    means: 'It can see every installed plugin, add one from a folder and delete installed ones, with what they stored.',
                },
            ],
            [
                'deckit.plugin-settings',
                {
                    label: 'Plugin Settings',
                    means: 'It can read and change the settings of every plugin, not only its own.',
                },
            ],
            [
                'deckit.key-map',
                { label: 'Key Map', means: 'It can bind, change and switch off the keys of every plugin.' },
            ],
            [
                'deckit.url-schemes',
                {
                    label: 'URL Schemes',
                    means: 'It can choose which plugin is asked first to open an address of each scheme, and switch them off.',
                },
            ],
        ]);
        const MAIN_PERMISSION = 'system.main-process';

        const VERSION = /^\d+\.\d+\.\d+$/;
        const KNOWN = new Set(['id', 'name', 'version', 'api', 'url-schemes', 'requires', 'permissions']);
        const { SCHEME, NOT_PLACES, EVERY: EVERY_SCHEME } = SCHEMES;
        const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

        /* Returns { manifest, problem }. The manifest comes back even with a problem, so the row that
     says what is wrong can still carry the plugin's name. */
        const check = (raw, folder) => {
            const id = String(folder);
            const m = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
            const manifest = {
                id,
                name: typeof m.name === 'string' && m.name.trim() ? m.name : id,
                version: typeof m.version === 'string' ? m.version : null,
                api: typeof m.api === 'string' ? m.api : null,
                requires: {},
                permissions: [],
                urlSchemes: [],
            };
            const problem = (() => {
                const bad = idProblem(id);
                if (bad) return bad;
                const unknown = Object.keys(m).filter((k) => !KNOWN.has(k));
                if (unknown.length)
                    return `${FILE} has ${unknown.map((k) => `"${k}"`).join(', ')}, which is not a manifest field`;
                if (typeof m.id !== 'string' || !m.id) return `${FILE} needs id = "${id}"`;
                if (m.id !== id) return `${FILE} says id = "${m.id}" but the folder is "${id}"; they must agree`;
                if (own(m, 'name') && (typeof m.name !== 'string' || !m.name.trim())) return 'name must be text';
                if (typeof m.version !== 'string' || !VERSION.test(m.version))
                    return `version must be written as "MAJOR.MINOR.PATCH", not ${JSON.stringify(m.version)}`;
                if (typeof m.api !== 'string')
                    return `${FILE} needs api = "MAJOR.MINOR.PATCH", the contract it is written against`;
                if (own(m, 'requires')) {
                    if (!m.requires || typeof m.requires !== 'object' || Array.isArray(m.requires))
                        return 'requires must be a [requires] table of plugin id = version';
                    for (const [other, want] of Object.entries(m.requires)) {
                        const why = idProblem(other);
                        if (why) return `requires ${other}: ${why}`;
                        if (typeof want !== 'string' || !VERSION.test(want))
                            return `requires ${other} must be written as "MAJOR.MINOR.PATCH", not ${JSON.stringify(want)}`;
                        manifest.requires[other] = want;
                    }
                }
                if (own(m, 'permissions')) {
                    const example =
                        '[permissions] table of name = "why it is needed", such as "system.main-process" = "…"';
                    if (!m.permissions || typeof m.permissions !== 'object' || Array.isArray(m.permissions))
                        return `permissions must be a ${example}`;
                    const unknownNames = Object.keys(m.permissions).filter((p) => !PERMISSIONS.has(p));
                    if (unknownNames.length)
                        return `unknown permission ${unknownNames.map((p) => `"${p}"`).join(', ')}; there are ${[...PERMISSIONS.keys()].map((p) => `"${p}"`).join(', ')}`;
                    const unexplained = Object.entries(m.permissions)
                        .filter(([, why]) => typeof why !== 'string' || !why.trim())
                        .map(([p]) => p);
                    if (unexplained.length)
                        return `permission ${unexplained.map((p) => `"${p}"`).join(', ')} needs the reason it is asked for, as text`;
                    manifest.permissions = [...PERMISSIONS]
                        .filter(([id]) => own(m.permissions, id))
                        .map(([id, { label, means }]) => ({ id, label, means, reason: m.permissions[id].trim() }));
                }
                if (own(m, 'url-schemes')) {
                    const example = 'url-schemes = ["https"], or ["*"] for every scheme';
                    const list = m['url-schemes'];
                    if (!Array.isArray(list) || !list.length)
                        return `url-schemes must be a list of schemes, as ${example}`;
                    const bad = list.filter((x) => typeof x !== 'string' || (x !== EVERY_SCHEME && !SCHEME.test(x)));
                    if (bad.length)
                        return `url-schemes: ${bad.map((x) => JSON.stringify(x)).join(', ')} is not a scheme; a scheme is lower case, as "https" or "my-app", with no ":"`;
                    const unplaced = list.filter((x) => NOT_PLACES.has(x));
                    if (unplaced.length)
                        return `url-schemes: ${unplaced.map((x) => `"${x}"`).join(', ')} is not a place; nothing opens it`;
                    if (list.includes(EVERY_SCHEME) && list.length > 1)
                        return `url-schemes: "${EVERY_SCHEME}" already takes every scheme, so it stands alone`;
                    manifest.urlSchemes = [...new Set(list)];
                }
                return '';
            })();
            return { manifest, problem };
        };

        const read = (text, folder) => {
            let raw;
            try {
                raw = parse(text);
            } catch (e) {
                return { ...check({}, folder), problem: `${FILE}: ${e.message}` };
            }
            return check(raw, folder);
        };

        // The version of the plugin contract, not of the app (document/PLUGIN.md, api).
        const HOST_API = '1.0.0';
        const parseVersion = (v) => {
            const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v == null ? '' : v));
            return m ? m.slice(1).map(Number) : null;
        };
        const satisfies = (have, need) => {
            const h = parseVersion(have),
                n = parseVersion(need);
            if (!h || !n || h[0] !== n[0]) return false;
            return h[1] > n[1] || (h[1] === n[1] && h[2] >= n[2]);
        };
        const apiProblem = (want) => {
            if (!parseVersion(want))
                return `api must be written as "MAJOR.MINOR.PATCH" (this host speaks ${HOST_API}), not ${JSON.stringify(want)}`;
            if (!satisfies(HOST_API, want)) return `needs api ${want}, this host speaks ${HOST_API}`;
            return '';
        };

        return { FILE, parse, read, idProblem, RESERVED_ID, MAIN_PERMISSION, HOST_API, satisfies, apiProblem };
    }
);
