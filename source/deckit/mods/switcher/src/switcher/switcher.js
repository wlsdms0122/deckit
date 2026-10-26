const LIST = require('../list/list.js');
const ACTION = require('../action/action.js');
const ITEMS = require('./items.js');

// What was picked before, kept so the list ranks it higher.
const USE = 'use';
const USE_KEPT = 60;
// Taken round robin up to this, so a mod with many actions loses its last ones rather than crowding others out.
const NOW_MAX = 3;
// How long the list waits for slow Now actions before it opens; later ones arrive on their own.
const NOW_WAIT_MS = 150;

// The list of a Show item for each mod the shell can show and the actions mods add through `point`, the switcher's
// point `actions`, in `window`, the mod's own: `toggle()` opens it, or puts it away when it is open. Each open reads
// the mods and their actions anew. What an action leaves for a person is said under the list, which stays open for it.
function switcher(deck, window, point) {
    const registry = deck.commandRegistry;
    const records = deck.storage.records;
    let open = null; // the list on screen: { list, left, about, submenus, chords }, `left` once its exit has started
    let leaving = null; // the timer that puts the window away once the list's exit has played

    return { toggle, putAway, closed };

    function toggle() {
        if (open && !open.left) return open.list ? open.list.close() : putAway();
        show();
    }

    // Opened again during its exit, the window stays up with a new list.
    async function show() {
        clearTimeout(leaving);
        leaving = null;
        if (open && !open.left) return;
        const current = { list: null, left: false, about: null, submenus: new Map(), chords: new Map() };
        open = current;
        window.open();
        let supplied;
        try {
            supplied = await supply(current);
        } catch (error) {
            console.error('[switcher] the actions could not be read', error);
        }
        if (open !== current) return;
        if (!supplied) return putAway();
        current.list = LIST.open(deck, {
            placeholder: 'Run an action or show a mod…',
            items: supplied.items,
            now: supplied.now,
            onQuery: (raw, submenu) => search(current, raw, submenu),
            onClose: () => leave(current),
        });
        supplied.later.then((items) => open === current && current.list.model.setNow(items));
    }

    // The window goes once the list's exit has played.
    function leave(current) {
        if (open !== current) return;
        current.left = true;
        clearTimeout(leaving);
        leaving = setTimeout(() => {
            leaving = null;
            putAway();
        }, deck.theme.motion.base);
    }

    // Away at once, as the keyboard goes elsewhere.
    function putAway() {
        if (!open) return;
        const current = open;
        open = null;
        clearTimeout(leaving);
        leaving = null;
        if (!current.left) current.list?.close();
        window.close();
    }

    // The window was put away where it was not asked to: the list goes with it.
    function closed() {
        if (open) putAway();
    }

    // The listed actions with the Show items, and what is happening now. `later` is the Now strip as the slow mods
    // land in it.
    async function supply(current) {
        const extensions = Object.entries(point.extensions());
        const listing = Promise.all(
            extensions.map(async ([mod, extension]) => [mod, (await actionsOf(mod, extension, 'list')) || []])
        );
        const shown = await showable();
        const actions = await listing;
        const mods = ITEMS.modsIn({ actions, shown });
        const found = await Promise.all(mods.map((id) => deck.provider(id)));
        current.about = {
            names: new Map(found.filter(Boolean).map(({ id, name }) => [id, name])),
            iconOf: deck.iconOf,
        };
        const used = records.get(USE, {});
        const listed = await withChords(current, ITEMS.listed({ actions, shown, about: current.about }));
        const items = listed.map((item) => hydrate(current, { ...item, used: frecency(used[keyOf(item)]) }, true));
        const buckets = [];
        const landed = extensions.map(([mod, extension], index) =>
            actionsOf(mod, extension, 'now')
                .then((actions) =>
                    withChords(
                        current,
                        (actions || []).map((each) => ITEMS.itemOf('now', mod, each, current.about))
                    )
                )
                .then((now) => (buckets[index] = now.map((item) => hydrate(current, item))))
        );
        await Promise.race([Promise.all(landed), new Promise((done) => setTimeout(done, NOW_WAIT_MS))]);
        const now = roundRobin(buckets);
        const later = Promise.all(landed).then(() => roundRobin(buckets));
        return { items, now, later };
    }

    // What each mod finds for what is typed, or inside a submenu what its mod finds inside the action that opened it.
    // Each answer is shown as it lands, so a slow mod holds back nobody. A query no one answers still gets one empty
    // reply: the list shows the last query's actions until it hears otherwise. A mod that answers null has a newer
    // search under way, and is not heard for this one.
    function search(current, raw, submenu) {
        const parent = submenu ? current.submenus.get(submenu) : null;
        const extensions = Object.entries(point.extensions()).filter(([mod]) => !parent || mod === parent.mod);
        const gathered = [];
        let left = extensions.length;
        let heard = false;
        const answer = () => open === current && current.list?.model.setResolved(raw, gathered, submenu);
        if (!left) return answer();
        for (const [mod, extension] of extensions)
            actionsOf(mod, extension, 'search', raw, parent ? parent.value : null)
                .then(
                    (actions) =>
                        actions &&
                        withChords(
                            current,
                            actions.map((each) => ITEMS.itemOf(parent?.id ?? raw, mod, each, current.about))
                        )
                )
                .then((found) => {
                    left--;
                    if (found) {
                        heard = true;
                        gathered.push(...found.map((item) => hydrate(current, item)));
                    }
                    if (found?.length || (!left && heard)) answer();
                });
    }

    // An item crosses as data and is made runnable here: one with a value runs it, and one that opens holds its
    // submenu. Only what the list holds is remembered: a readout or an answer is not something to run again.
    function hydrate(current, item, remembers = false) {
        if (item.opens) {
            current.submenus.set(item.id, item);
            return { ...item, run: () => remembers && remember(item), submenu: { icon: item.icon } };
        }
        if (item.shows || item.value !== null) return { ...item, run: () => go(current, item, remembers) };
        return { ...item, run: undefined };
    }

    // Run as a person picked it: a Show item by the shell, an action by its mod, which puts itself on screen where it
    // means to. What it leaves for the person, or why it did not run, is said under the list; with nothing to say the
    // list goes.
    async function go(current, item, remembers) {
        if (remembers) remember(item);
        let said = null;
        try {
            const left = item.shows
                ? await registry.run(ITEMS.SHOW, { mod: item.shows })
                : await extensionOf(item.mod).run(item.value);
            if (typeof left === 'string' && left) said = { text: left, alert: false };
        } catch (error) {
            said = { text: error?.message || String(error), alert: true };
        }
        if (open !== current || current.left) {
            if (said?.alert) console.error(`[switcher] ${item.label} did not run once the list was away: ${said.text}`);
            return;
        }
        if (said) current.list.model.say(said.text, { alert: said.alert });
        else current.list.close();
    }

    function extensionOf(mod) {
        const extension = point.extensions()[mod];
        if (typeof extension?.run !== 'function') throw new Error(`${mod} has no actions now`);
        return extension;
    }

    // The mods the shell can show, as its Show command completes them, or none for a host with no shell.
    async function showable() {
        const commands = await registry.list();
        const { provider, command } = ITEMS.SHOW;
        if (!commands.some((entry) => entry.provider === provider && entry.command === command)) return [];
        return (await registry.complete(ITEMS.SHOW, 'mod', '')) || [];
    }

    // The actions `extension` answers to `name`, as `action.js` reads them, or null where it answers null.
    async function actionsOf(mod, extension, name, ...args) {
        if (typeof extension?.[name] !== 'function') return [];
        try {
            const actions = await extension[name](...args);
            if (actions === null) return null;
            return (Array.isArray(actions) ? actions : []).map(ACTION.read).filter(Boolean);
        } catch (error) {
            console.error(`[switcher] ${mod}'s ${name} answered nothing`, error);
            return [];
        }
    }

    // Each item with the chord its key is bound to now, asked once an open.
    function withChords(current, items) {
        return Promise.all(
            items.map(async (item) => {
                if (!item.key) return item;
                const id = `${item.mod}\u0000${item.key}`;
                if (!current.chords.has(id)) current.chords.set(id, deck.chordOf(item.key, { provider: item.mod }));
                return { ...item, chord: (await current.chords.get(id)) || '' };
            })
        );
    }

    function roundRobin(buckets) {
        const out = [];
        for (let depth = 0; out.length < NOW_MAX; depth++) {
            const round = buckets.filter((bucket) => bucket?.length > depth);
            if (!round.length) break;
            for (const bucket of round) if (out.length < NOW_MAX) out.push(bucket[depth]);
        }
        return out;
    }

    // Keyed by what it runs, as an item is made fresh on every open: a mod gives an action the same value each time.
    function keyOf({ mod, value, shows }) {
        return JSON.stringify(shows ? [ITEMS.SHOW.provider, shows] : [mod, value]);
    }

    // Too small to outweigh a use, the time only breaks ties, the later first.
    function frecency(use) {
        if (!use) return 0;
        const hours = (Date.now() - use.at) / 3.6e6;
        const weight = hours < 1 ? 4 : hours < 24 ? 2 : hours < 168 ? 1 : hours < 720 ? 0.5 : 0.2;
        return Math.min(use.count, 30) * weight + use.at / 1e15;
    }

    function remember(item) {
        const used = records.get(USE, {});
        const key = keyOf(item);
        used[key] = { count: (used[key]?.count || 0) + 1, at: Date.now() };
        const kept = Object.entries(used)
            .sort((a, b) => frecency(b[1]) - frecency(a[1]))
            .slice(0, USE_KEPT);
        records.set(USE, Object.fromEntries(kept));
    }
}

module.exports = { switcher };
