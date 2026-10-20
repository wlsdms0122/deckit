import * as LAYER from '../layer/index.js';

// What an environment gives deck, as plain data: what carries messages between main and a page, and what it tells of
// a page, on main's side (`MAIN`) and on a page's (`PAGE`). An environment gives at least this, and deck is handed
// this alone (`checked`). Each leaf says what a member is, as in layer/. Of one page, what watches it is told in the
// order it began watching, before what the environment itself watches after it: deck relies on that order
// (deck/identity).
// MARK: - Property
/**
 * A page: a token deck keeps, compares, keys by and hands back, and never reads. The environment hands the same
 * token as the page's maker gets, as what sent a message, and to what watches it.
 * @typedef {object} Page
 *
 * What crosses, cloned as it crosses: deck's router says what each message holds (deck/ipc/model/envelope.js).
 * @typedef {object} Message
 */

const MAIN = Object.freeze({
    messages: {
        // listen({ told(page, message), asked(page, message) -> Promise, askedSync(page, message) -> Promise,
        // answered(page, message) }), once: what a page tells, asks, asks sync and answers. A page asking sync
        // waits until the promise settles, and is handed what it settles with.
        listen: 'function',
        tell: 'function', // tell(page, message): dropped when the page is gone
        ask: 'function', // ask(page, message): answered by the page through `answered`
    },
    pages: {
        isGone: 'function', // isGone(page): destroyed, or its renderer crashed
        // watch(page, { ended, destroyed }): `ended()` each time the page's document goes, replaced by a navigation
        // that commits or by a crash, the token living on; `destroyed()` once, as the token goes
        watch: 'function',
        // watchInput(page, listener({ type })): `keyDown` before anything watching after it may take the key, and
        // `mouseDown`, `mouseUp`
        watchInput: 'function',
    },
});

const PAGE = Object.freeze({
    messages: {
        // listen({ told(message), asked(message) }), once: what main tells and asks, from the page's start, kept
        // until something listens
        listen: 'function',
        tell: 'function', // tell(message): throws at once when the message cannot be cloned
        ask: 'function', // ask(message) -> Promise
        askSync: 'function', // askSync(message): what main's promise settled with
        answer: 'function', // answer(message): throws at once when the message cannot be cloned
    },
});

// MARK: - Initializer
// MARK: - Public
const { checked } = LAYER;

// MARK: - Private

export { MAIN, PAGE, checked };
