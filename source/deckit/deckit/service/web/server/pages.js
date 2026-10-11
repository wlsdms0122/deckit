DeckitModule.define(
    'deckit/service/web/server/pages',
    {
        uses: ['deckit/service/web/server/agent'],
        provides: ['has', 'entries', 'get', 'own', 'tabOf', 'isTab', 'send'],
    },
    (AGENT) => {
        /* webContents id -> { h, tab, inPanel }. `h`: the panel page holding it. `tab`: the id of the
     page whose delegate answers for it (itself, or the page that opened it). `inPanel`: an element
     of the panel's document, whose keystrokes count as the panel's. */
        const pages = new Map();
        const own = (wc, h, tab, { inPanel = false } = {}) => {
            const id = wc.id;
            pages.set(id, { h: h || null, tab: tab ?? null, inPanel: !!inPanel });
            wc.once('destroyed', () => pages.delete(id));
            AGENT.presentAsBrowser(wc);
        };
        const tabOf = (wc) => {
            const p = wc && pages.get(wc.id);
            if (!p?.h || p.tab == null) return null;
            const { webContents } = require('electron');
            const tab = webContents.fromId(p.tab);
            return tab && !tab.isDestroyed() ? { h: p.h, tab } : null;
        };
        // A page with a delegate of its own, not a window some page opened.
        const isTab = (id) => pages.get(id)?.tab === id;

        const send = (h, end, payload) => end.send(h.wc, payload);

        return {
            has: (id) => pages.has(id),
            entries: () => pages.entries(),
            get: (id) => pages.get(id),
            own,
            tabOf,
            isTab,
            send,
        };
    }
);
