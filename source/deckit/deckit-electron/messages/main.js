// What carries what crosses between the pages of deck's and main, on main's side (protocol.js): what each channel's
// handler answers, and deck's messages over it (deckit-shell/environment: MAIN.messages), a page's sender the page.
import * as WIRE from './protocol.js';

export function createMessages() {
    // MARK: - Property
    const handlers = new Map(); // channel -> handler(page, body), answering a value or a promise of one
    // page -> { document, heard, waiting }: how many posts its document's main has heard, and the questions that wait
    // on more, each { after, ask }
    const orders = new WeakMap();
    let listening = false;

    // MARK: - Initializer
    // MARK: - Public
    // `handler(page, body)` hears `channel`, once: a tell's answer is dropped.
    function on(channel, handler) {
        if (handlers.has(channel)) throw new Error(`[deckit] ${channel} is heard already`);
        handlers.set(channel, handler);
    }

    // What a page posted.
    function posted(page, text) {
        const { channel, body, document } = JSON.parse(text);
        const order = orderOf(page, document);
        try {
            handlers.get(channel)?.(page, body);
        } finally {
            if (order) {
                order.heard++;
                const ready = order.waiting.filter(({ after }) => after <= order.heard);
                order.waiting = order.waiting.filter(({ after }) => after > order.heard);
                for (const { ask } of ready) ask();
            }
        }
    }

    // What a page asked, by a POST to its origin, answered once the handler's answer settles.
    function requested(page, { body, reply }) {
        const sent = JSON.parse(body || '{}');
        const handler = handlers.get(sent.channel);
        const answer = (status, value) => reply({ status, type: 'application/json', body: JSON.stringify(value) });
        const ask = () =>
            Promise.resolve()
                .then(() => (handler ? handler(page, sent.body) : Promise.reject(new Error(`no ${sent.channel}`))))
                .then(
                    (value) => answer(200, { value }),
                    (error) => answer(500, { error: String(error?.message || error) })
                );
        const order = orderOf(page, sent.document);
        if (order && order.heard < sent.after) order.waiting.push({ after: sent.after, ask });
        else ask();
    }

    // `body` on `channel` to a page, unless it is gone.
    function tell(page, channel, body) {
        if (page.isDestroyed()) return;
        const call = `globalThis[Symbol.for(${JSON.stringify(WIRE.TOLD)})]?.(${JSON.stringify({ channel, body })})`;
        page.evaluate(`${call}; return null;`, 'deckit').catch(() => {});
    }

    function listen({ told, asked, askedSync }) {
        if (listening) throw new Error('[deckit] deck is heard already');
        listening = true;
        on(WIRE.CHANNEL.deckTell, told);
        on(WIRE.CHANNEL.deckAsk, asked);
        on(WIRE.CHANNEL.deckAskSync, askedSync);
    }

    // MARK: - Private
    // What main heard of the document of the page's that sent: a post or question of a document after it begins the
    // count again, and one of a document before it is heard as it comes.
    function orderOf(page, document) {
        const order = orders.get(page);
        if (order?.document === document) return order;
        if (order && order.retired.has(document)) return null;
        const retired = new Set(order ? [...order.retired, order.document] : []);
        const next = { document, heard: 0, waiting: [], retired };
        orders.set(page, next);
        return next;
    }

    return {
        on,
        posted,
        requested,
        tell,
        messages: Object.freeze({ listen, tell: (page, message) => tell(page, WIRE.CHANNEL.deckTell, message) }),
    };
}

export { CHANNEL } from './protocol.js';
