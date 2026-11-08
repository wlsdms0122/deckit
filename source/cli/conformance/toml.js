// The manifest text, the language based on TOML the bundle's DECKIT fixes (spec/DECKIT-2), read into values: a string, a
// number, a boolean, an array, or a table, an object with no prototype. What the text does not hold throws, with the
// line it is on.
const WS = /\p{White_Space}/u;
const BARE = /[A-Za-z0-9_-]/;
const DEPTH = 32;
const MAX = 2n ** 53n - 1n;
const MIN = -MAX;

function read(text) {
    const lines = text
        .replace(/^﻿/, '')
        .split('\n')
        .map((line) => line.replace(/\r$/, ''));
    const root = table();
    const opened = new WeakSet(); // the tables a table-header opened
    const arrays = new WeakSet(); // the arrays of tables array-headers made
    let current = root;
    for (let at = 0; at < lines.length; at++) {
        const fail = (why) => {
            throw new Error(`line ${at + 1}: ${why}`);
        };
        const line = lines[at];
        const start = skip(line, 0);
        if (start === line.length || line[start] === '#') continue;
        if (line[start] === '[') {
            const array = line[start + 1] === '[';
            const cursor = { text: line, at: start + (array ? 2 : 1), fail };
            const path = keyPath(cursor);
            for (const close of array ? ']]' : ']') {
                if (line[cursor.at] !== close) fail('a header is not closed');
                cursor.at++;
            }
            rest(cursor);
            current = array ? appendTo(path, fail) : open(path, fail);
            continue;
        }
        const keyCursor = { text: line, at: start, fail };
        const name = key(keyCursor);
        const equals = skip(line, keyCursor.at);
        if (line[equals] !== '=') fail('a key is followed by more than "="');
        let value = '';
        let tail = line.slice(equals + 1);
        const state = { depth: 0, quote: null };
        for (;;) {
            value += scan(tail, state);
            if (state.depth <= 0) break;
            if (++at === lines.length) fail('an array is not closed');
            value += '\n';
            tail = lines[at];
        }
        const cursor = { text: value, at: 0, fail };
        cursor.at = skip(value, 0, true);
        const parsed = parseValue(cursor, 0);
        if (skip(value, cursor.at, true) !== value.length) fail('a value is followed by more');
        set(current, name, parsed, fail);
    }
    return root;

    function open(path, fail) {
        let at = root;
        for (const [index, name] of path.entries()) {
            const last = index === path.length - 1;
            if (!(name in at)) {
                at[name] = table();
                if (last) opened.add(at[name]);
                at = at[name];
                continue;
            }
            const held = at[name];
            if (Array.isArray(held)) {
                if (last) fail(`[${path.join('.')}] holds an array`);
                if (!isTable(held.at(-1))) fail(`[${path.join('.')}] goes through an array ending in no table`);
                at = held.at(-1);
            } else if (isTable(held)) {
                if (last) {
                    if (opened.has(held)) fail(`[${path.join('.')}] is opened twice`);
                    opened.add(held);
                }
                at = held;
            } else fail(`[${path.join('.')}] goes through a value that is no table`);
        }
        return at;
    }

    function appendTo(path, fail) {
        let at = root;
        for (const [index, name] of path.entries()) {
            const last = index === path.length - 1;
            const held = at[name];
            if (last) {
                if (held === undefined) arrays.add((at[name] = []));
                else if (!arrays.has(held)) fail(`[[${path.join('.')}]] names a value no array-header made`);
                const made = table();
                at[name].push(made);
                return made;
            }
            if (held === undefined) at = at[name] = table();
            else if (Array.isArray(held) && isTable(held.at(-1))) at = held.at(-1);
            else if (isTable(held)) at = held;
            else fail(`[[${path.join('.')}]] goes through a value that is no table`);
        }
    }
}

function table() {
    return Object.create(null);
}

function isTable(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function set(into, name, value, fail) {
    if (name in into) fail(`${name} is set twice`);
    into[name] = value;
}

// The index of the first code point from `at` that is no white space; LF too where `lines`.
function skip(text, at, lines = false) {
    while (at < text.length && (WS.test(text[at]) ? text[at] !== '\n' || lines : false)) at++;
    return at;
}

// A value's text on one line, up to the line's comment. `state` is carried from the line before: how many more `[`
// than `]` the value holds outside its strings, and the quote of a string still open.
function scan(line, state) {
    let text = '';
    for (let at = 0; at < line.length; at++) {
        const character = line[at];
        if (state.quote) {
            text += character;
            if (state.quote === '"' && character === '\\') text += line[++at] ?? '';
            else if (character === state.quote) state.quote = null;
            continue;
        }
        if (character === '#') break;
        if (character === '"' || character === "'") state.quote = character;
        else if (character === '[') state.depth++;
        else if (character === ']') state.depth--;
        text += character;
    }
    return text;
}

// After a header: white space, then a comment or nothing.
function rest(cursor) {
    const at = skip(cursor.text, cursor.at);
    if (at < cursor.text.length && cursor.text[at] !== '#') cursor.fail('a header is followed by more');
}

function keyPath(cursor) {
    const path = [];
    for (;;) {
        cursor.at = skip(cursor.text, cursor.at);
        path.push(key(cursor));
        cursor.at = skip(cursor.text, cursor.at);
        if (cursor.text[cursor.at] !== '.') return path;
        cursor.at++;
    }
}

function key(cursor) {
    cursor.at = skip(cursor.text, cursor.at);
    if (cursor.text[cursor.at] === '"') return basicString(cursor);
    const start = cursor.at;
    while (cursor.at < cursor.text.length && BARE.test(cursor.text[cursor.at])) cursor.at++;
    if (cursor.at === start) cursor.fail('a key is missing');
    return cursor.text.slice(start, cursor.at);
}

function parseValue(cursor, depth) {
    const { text } = cursor;
    const character = text[cursor.at];
    if (character === '"') return basicString(cursor);
    if (character === "'") {
        const end = text.indexOf("'", cursor.at + 1);
        if (end < 0) cursor.fail('a literal string is not closed');
        const value = text.slice(cursor.at + 1, end);
        cursor.at = end + 1;
        return value;
    }
    if (character === '[' || character === '{') {
        if (depth === DEPTH) cursor.fail(`values nest more than ${DEPTH} deep`);
        return character === '[' ? array(cursor, depth + 1) : inlineTable(cursor, depth + 1);
    }
    for (const word of ['true', 'false'])
        if (text.startsWith(word, cursor.at)) {
            cursor.at += word.length;
            return word === 'true';
        }
    const integer = /^[+-]?[0-9]+/.exec(text.slice(cursor.at));
    if (!integer) cursor.fail('a value is none the manifest text holds');
    cursor.at += integer[0].length;
    const value = BigInt(integer[0]);
    if (value < MIN || value > MAX) cursor.fail(`${integer[0]} lies beyond ±(2^53 - 1)`);
    return Number(value);
}

function array(cursor, depth) {
    const values = [];
    cursor.at++;
    for (;;) {
        cursor.at = skip(cursor.text, cursor.at, true);
        if (cursor.text[cursor.at] === ']') break;
        values.push(parseValue(cursor, depth));
        cursor.at = skip(cursor.text, cursor.at, true);
        if (cursor.text[cursor.at] === ',') cursor.at++;
        else if (cursor.text[cursor.at] !== ']') cursor.fail('an array is not closed');
    }
    cursor.at++;
    return values;
}

function inlineTable(cursor, depth) {
    const values = table();
    cursor.at++;
    cursor.at = skip(cursor.text, cursor.at, true);
    if (cursor.text[cursor.at] === '}') {
        cursor.at++;
        return values;
    }
    for (;;) {
        cursor.at = skip(cursor.text, cursor.at, true);
        const name = key(cursor);
        cursor.at = skip(cursor.text, cursor.at, true);
        if (cursor.text[cursor.at] !== '=') cursor.fail('an inline table holds a key with no "="');
        cursor.at = skip(cursor.text, cursor.at + 1, true);
        set(values, name, parseValue(cursor, depth), cursor.fail);
        cursor.at = skip(cursor.text, cursor.at, true);
        if (cursor.text[cursor.at] === '}') break;
        if (cursor.text[cursor.at] !== ',') cursor.fail('an inline table is not closed');
        cursor.at++;
    }
    cursor.at++;
    return values;
}

const ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\' };

function basicString(cursor) {
    const { text } = cursor;
    let value = '';
    for (let at = cursor.at + 1; at < text.length; at++) {
        const character = text[at];
        if (character === '"') {
            cursor.at = at + 1;
            return value;
        }
        if (character !== '\\') {
            value += character;
            continue;
        }
        const escape = text[++at];
        if (escape in ESCAPES) {
            value += ESCAPES[escape];
            continue;
        }
        const length = { u: 4, U: 8 }[escape];
        const hex = text.slice(at + 1, at + 1 + length);
        if (!length || !new RegExp(`^[0-9A-Fa-f]{${length}}$`).test(hex)) cursor.fail('a string holds no escape');
        const point = parseInt(hex, 16);
        if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff))
            cursor.fail(`\\${escape}${hex} is no scalar value`);
        value += String.fromCodePoint(point);
        at += length;
    }
    cursor.fail('a string is not closed');
}

module.exports = { read, isTable };
