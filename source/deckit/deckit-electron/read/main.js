// How a page is read, asked of the reader each of its documents runs (reader.js): the answers as plain data, close to
// the lines they are told as. A document has a number, counted up as a page's reader is first heard, so a new document
// in the same page has another; an element's ref is `<document>.<n>`, `n` the reader's number for it, the same while
// the element is in its document. What is asked of an element that is gone, of a document the page shows no more, or
// of a page that is closed, is refused with an error whose `code` is `GONE`; changes asked since a count older than
// the reader keeps, with `STALE`.
import { READER } from './reader.js';

export function createRead({ LOG }) {
    // MARK: - Property
    const documents = new WeakMap(); // page -> { key, number }, the document its reader last answered from
    const hearing = new Set(); // handler({ page, document, count })
    let last = 0;

    // MARK: - Initializer
    // MARK: - Public
    // The page's document as lines, top to bottom: `{ document, count, width, height, lines }`, `count` the reader's
    // count the answer is at, `width` and `height` the page's, and each line `{ depth, role, name, length, states,
    // items, inView, below, ref }`: `name` cut to `text` characters with its whole `length` where it was cut, `states`
    // words as they are told (`pressed`, `not expanded`, `current=page`, `focused`, `text 1761`, `value "a"`), `items`
    // and `inView` the items it holds and how many of them are listed or in view, `below` the elements under a line
    // at the deepest level. `knobs`: `depth` (30), `roles` (all), only lines of these roles and those that hold them,
    // `all` (false), the whole document and not what is in view, `items` (30), the items of one container listed,
    // `text` (80).
    async function outline(page, knobs = {}) {
        const answer = await ask(page, `outline(${JSON.stringify(knobs)})`);
        const document = numberOf(page, answer.key);
        const { count, width, height, lines } = answer;
        return { document, count, width, height, lines: lines.map((line) => withRef(document, line)) };
    }

    // What is under one ref: `{ document, count, line, rect, scroll, lines, more, selection, caret, selected }`: its
    // own line, its rect in the page, `{ top, height, left, width }` where it scrolls, the lines under it, text too
    // (`role` `text`), `more` the lines left out, `selection`, `{ start, end }` in a field's value or `{ line, column,
    // length }` in editable content, and, while it has its document's focus, `caret`, the rect its caret is drawn at,
    // and `selected`, the rects what is selected in it is drawn at, one a line of text, where anything is. `knobs` as
    // of `outline`, `text` 200, and `lines`, the text lines listed, those in view where it is not given.
    async function node(page, ref, knobs = {}) {
        const { document, number, key } = named(page, ref);
        const answer = await ask(page, `node(${JSON.stringify(key)}, ${number}, ${JSON.stringify(knobs)})`);
        const { count, line, lines, key: _key, ...rest } = answer;
        return {
            document,
            count,
            ...rest,
            line: withRef(document, line),
            lines: lines.map((l) => withRef(document, l)),
        };
    }

    // What reads otherwise in one document since `since`, `{ document, count }` as an answer carried them: `{ document,
    // from, count, entries }`, each entry `{ kind: '~', ...line }`, a line as it reads now, `{ kind: '+', ...line }`,
    // one not answered before, or `{ kind: '-', ref }`, an element gone. A line out of sight has the state `not in
    // view`.
    async function changes(page, since) {
        const held = documents.get(page);
        if (!held || held.number !== since?.document) throw refusal('GONE');
        const answer = await ask(page, `changes(${JSON.stringify(held.key)}, ${Number(since.count)})`);
        return {
            document: held.number,
            from: answer.from,
            count: answer.count,
            entries: answer.entries.map((entry) => withRef(held.number, entry)),
        };
    }

    // The rect of what a ref names, in its page, once it is scrolled into view: `{ x, y, width, height }`.
    async function place(page, ref) {
        const { number, key } = named(page, ref);
        return (await ask(page, `place(${JSON.stringify(key)}, ${number})`)).rect;
    }

    // Each count a document's reader seals, as what it shows changes, at most once a frame: `handler({ page, document,
    // count })`. Answers its off.
    function listen(handler) {
        hearing.add(handler);
        return () => hearing.delete(handler);
    }

    // What a page posted, where it is the reader's word: whether it was.
    function told(page, body) {
        if (typeof body !== 'string' || !body.startsWith('{"reader":')) return false;
        let word = null;
        try {
            word = JSON.parse(body).reader;
        } catch {
            return true;
        }
        if (typeof word?.key !== 'string' || !Number.isInteger(word.count)) return true;
        const heard = Object.freeze({ page, document: numberOf(page, word.key), count: word.count });
        for (const handler of [...hearing]) {
            try {
                handler(heard);
            } catch (error) {
                LOG.error('a listener of the reader failed', error);
            }
        }
        return true;
    }

    // MARK: - Private
    // The reader's answer in the page's document, refused where there is none or it refuses.
    async function ask(page, call) {
        if (page.isDestroyed()) throw refusal('GONE');
        let answer = null;
        try {
            answer = await page.evaluate(`return globalThis.deckitReader?.${call} ?? null`, 'deckit');
        } catch {
            throw refusal('GONE');
        }
        if (!answer) throw refusal('GONE');
        if (answer.error) throw refusal(answer.error);
        return answer;
    }

    // The number of the page's document whose reader has `key`, counted the first time it is heard.
    function numberOf(page, key) {
        const held = documents.get(page);
        if (held?.key === key) return held.number;
        documents.set(page, { key, number: ++last });
        return last;
    }

    // What a ref names, where its document is the one the page shows.
    function named(page, ref) {
        const [, document, number] = /^(\d+)\.(\d+)$/.exec(String(ref)) ?? [];
        const held = documents.get(page);
        if (!held || held.number !== Number(document)) throw refusal('GONE');
        return { document: held.number, number: Number(number), key: held.key };
    }

    function withRef(document, { number, ...line }) {
        return number === undefined ? line : { ...line, ref: `${document}.${number}` };
    }

    function refusal(code) {
        return Object.assign(
            new Error(`[deckit] ${code === 'STALE' ? 'the count is too old' : 'nothing to read there'}`),
            {
                code,
            }
        );
    }

    return Object.freeze({ outline, node, changes, place, listen, told });
}

// The script every document of every page starts with to be read, as a page runs one.
export const SCRIPT = Object.freeze({ source: READER, world: 'deckit' });
