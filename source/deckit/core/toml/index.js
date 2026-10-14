DeckitModule.define(
    'core/toml',
    {
        uses: [],
        provides: ['parse'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        const KEY = /^(?:[A-Za-z0-9_-]+|"(?:[^"\\]|\\.)*")$/;
        const ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\' };

        // MARK: - Initializer
        // MARK: - Public
        // The subset of TOML a manifest is written in: tables, bare and quoted keys, strings, integers,
        // booleans and arrays. Anything else is refused by line. Tables have no prototype, so every key,
        // __proto__ included, is a field and a lookup finds only what the text said.
        function parse(text) {
            const out = Object.create(null);
            let table = out;
            const lines = String(text).replace(/^﻿/, '').split(/\r?\n/);
            for (let index = 0; index < lines.length; index++) {
                const line = index + 1;
                const body = withoutComment(lines[index]).trim();
                if (!body) continue;
                const head = /^\[([A-Za-z0-9_-]+)\]$/.exec(body);
                if (head) {
                    const name = head[1];
                    if (Object.hasOwn(out, name)) throw new Error(`line ${line}: [${name}] appears twice`);
                    table = out[name] = Object.create(null);
                    continue;
                }
                const equals = body.indexOf('=');
                if (equals < 0) throw new Error(`line ${line}: expected key = value`);
                const rawKey = body.slice(0, equals).trim();
                // TOML reads a bare dotted key as a table inside a table; a dotted name is written in quotes.
                if (/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/.test(rawKey)) {
                    throw new Error(`line ${line}: a name with a dot is written in quotes: "${rawKey}" = …`);
                }
                if (!KEY.test(rawKey)) throw new Error(`line ${line}: not a key this reads: ${rawKey}`);
                const key = rawKey.startsWith('"') ? unquote(rawKey, line) : rawKey;
                if (Object.hasOwn(table, key)) throw new Error(`line ${line}: ${key} is set twice`);
                let rest = body.slice(equals + 1);
                let depth = bracketDepth(rest);
                while (depth > 0 && index + 1 < lines.length) {
                    index++;
                    const more = withoutComment(lines[index]);
                    depth += bracketDepth(more);
                    rest += '\n' + more;
                }
                const [value, after] = valueOf(rest, line);
                if (after.trim()) throw new Error(`line ${line}: unexpected text after the value of ${key}`);
                table[key] = value;
            }
            return out;
        }

        // MARK: - Private
        function unquote(raw, line) {
            if (raw.startsWith("'")) return raw.slice(1, -1);
            return raw.slice(1, -1).replace(/\\(u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|.)/g, (_all, escape) => {
                if (escape[0] === 'u' || escape[0] === 'U') return String.fromCodePoint(parseInt(escape.slice(1), 16));
                if (!Object.hasOwn(ESCAPES, escape)) throw new Error(`line ${line}: unknown escape \\${escape}`);
                return ESCAPES[escape];
            });
        }

        function valueOf(text, line) {
            const source = text.trimStart();
            let match;
            if ((match = /^"(?:[^"\\]|\\.)*"/.exec(source)) || (match = /^'[^']*'/.exec(source))) {
                return [unquote(match[0], line), source.slice(match[0].length)];
            }
            if ((match = /^(true|false)\b/.exec(source))) return [match[1] === 'true', source.slice(match[0].length)];
            if ((match = /^[+-]?\d+(?![\w.])/.exec(source))) return [Number(match[0]), source.slice(match[0].length)];
            if (source.startsWith('[')) return arrayOf(source, line);
            throw new Error(`line ${line}: not a value this reads: ${source.split('\n')[0].slice(0, 40)}`);
        }

        function arrayOf(source, line) {
            const out = [];
            let rest = source.slice(1).trimStart();
            while (!rest.startsWith(']')) {
                const [value, after] = valueOf(rest, line);
                out.push(value);
                rest = after.trimStart();
                if (rest.startsWith(',')) rest = rest.slice(1).trimStart();
                else if (!rest.startsWith(']')) throw new Error(`line ${line}: expected , or ] in an array`);
            }
            return [out, rest.slice(1)];
        }

        // Visits each character outside a string. A basic string takes backslash escapes, a literal one does
        // not. `visit` returning true stops the walk at that index.
        function outsideStrings(text, visit) {
            let quote = null;
            for (let index = 0; index < text.length; index++) {
                const character = text[index];
                if (quote) {
                    if (character === '\\' && quote === '"') index++;
                    else if (character === quote) quote = null;
                } else if (character === '"' || character === "'") quote = character;
                else if (visit(character, index)) return index;
            }
            return -1;
        }

        function withoutComment(text) {
            const at = outsideStrings(text, (character) => character === '#');
            return at < 0 ? text : text.slice(0, at);
        }

        function bracketDepth(text) {
            let depth = 0;
            outsideStrings(text, (character) => {
                if (character === '[') depth++;
                else if (character === ']') depth--;
                return false;
            });
            return depth;
        }

        return { parse };
    }
);
