const LIST = require('../list/list.js');
const PARAMS = require('../command/params.js');
const ROW = require('../row/row.js');
const ITEMS = require('./items.js');

// What was picked before, kept so the list ranks it higher.
const USE = 'use';
const USE_KEPT = 60;
// Taken round robin up to this, so a mod with many rows loses its last ones rather than crowding others out.
const NOW_MAX = 3;
// How long the list waits for slow Now rows before it opens; later ones arrive on their own.
const NOW_WAIT_MS = 150;

// The list of every command a person can run and the rows mods add to it, in `window`, the mod's own, from `point`,
// its point `rows`: `toggle()` opens it, or puts it away when it is open. Each open reads the commands and the rows
// anew. What a command leaves for a person is said under the list, which stays open for it.
function switcher(deck, window, point) {
    const registry = deck.commandRegistry;
    const records = deck.storage.records;
    let open = null; // the list on screen: { list, left, commands, owners, submenus }, `left` once its exit has started
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
        const current = { list: null, left: false, commands: [], owners: null, submenus: new Map(), asking: null };
        open = current;
        window.open();
        let supplied;
        try {
            supplied = await supply(current);
        } catch (error) {
            console.error('[switcher] the commands could not be read', error);
        }
        if (open !== current) return;
        if (!supplied) return putAway();
        current.list = LIST.open(deck, {
            placeholder: 'Run a command or show a mod…',
            items: supplied.items,
            now: supplied.now,
            onQuery: (raw, submenu) => (submenu ? complete(current, raw, submenu) : resolve(current, raw)),
            onClose: () => leave(current),
        });
        supplied.later.then((rows) => open === current && current.list.model.setNow(rows));
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
        current.asking?.abort();
        if (!current.left) current.list?.close();
        window.close();
    }

    // The window was put away where it was not asked to: the list goes with it.
    function closed() {
        if (open) putAway();
    }

    // The commands with the listed rows, and what is happening now. `later` is the Now strip as the slow mods land
    // in it.
    async function supply(current) {
        const extensions = Object.entries(point.extensions());
        const listing = Promise.all(extensions.map(([mod, extension]) => rowsOf(mod, extension, 'rows')));
        const commands = await registry.list();
        const shown = commands.some(ITEMS.isShow) ? (await registry.complete(ITEMS.SHOW, 'mod', '')) || [] : [];
        current.commands = commands;
        current.owners = {
            names: ITEMS.namesOf(commands, shown),
            iconOf: deck.iconOf,
            keywords: ITEMS.keywordsOf(commands),
        };
        const used = records.get(USE, {});
        const items = ITEMS.listed({ commands, rows: await listing, shown, iconOf: deck.iconOf }).map((item) =>
            hydrate(current, { ...item, used: frecency(used[keyOf(item)]) }, { remembers: true })
        );
        const buckets = [];
        const landed = extensions.map(([mod, extension], index) =>
            rowsOf(mod, extension, 'now').then(
                ([, rows]) =>
                    (buckets[index] = rows.map((row) =>
                        hydrate(current, ITEMS.answered('now', mod, row, current.owners))
                    ))
            )
        );
        await Promise.race([Promise.all(landed), new Promise((done) => setTimeout(done, NOW_WAIT_MS))]);
        const now = roundRobin(buckets);
        const later = Promise.all(landed).then(() => roundRobin(buckets));
        return { items, now, later };
    }

    // Each answer is shown as it lands, so a slow mod holds back nobody. A query no one answers still gets one
    // empty reply: the list shows the last query's rows until it hears otherwise.
    function resolve(current, raw) {
        const extensions = Object.entries(point.extensions());
        const gathered = [];
        let left = extensions.length;
        const answer = () => open === current && current.list?.model.setResolved(raw, gathered, null);
        if (!left) return answer();
        for (const [mod, extension] of extensions)
            rowsOf(mod, extension, 'resolve', raw).then(([, rows]) => {
                left--;
                gathered.push(...rows.map((row) => hydrate(current, ITEMS.answered(raw, mod, row, current.owners))));
                if (rows.length || !left) answer();
            });
    }

    // The values offered for the arg a submenu fills: the ones its schema lists, given once and ranked here, or else
    // what the command's completion answers for what is typed, in its order, with the text as typed last where any
    // text is a value. A newer query aborts the completion before it, which answers null and is not drawn.
    async function complete(current, raw, submenu) {
        const parent = current.submenus.get(submenu);
        const { mod, command, args, param } = parent.completes;
        const params = paramsOf(current, parent.completes);
        const choices = PARAMS.choicesOf(params, param);
        let found = choices;
        if (!found) {
            current.asking?.abort();
            const asking = (current.asking = new AbortController());
            try {
                found = await registry.complete({ mod, command }, param, raw, { args, signal: asking.signal });
            } catch (error) {
                console.error(`[switcher] ${mod}.${command} completed nothing`, error);
                found = [];
            }
        }
        if (!found || open !== current) return;
        const typed =
            raw && PARAMS.takesText(params, param) && !found.some(({ value }) => value === raw)
                ? [{ value: raw, title: raw, hint: PARAMS.titleOf(params, param), keywords: [] }]
                : [];
        const entries = [...found, ...typed].map((candidate) =>
            hydrate(current, ITEMS.offered(parent, candidate, params))
        );
        current.list?.model.setResolved(raw, entries, submenu);
    }

    // An item crosses as data and is made runnable here: one with a reference runs it, and one that completes opens
    // the list that fills its arg. Only what the list holds is remembered: a readout or an answer is not something to
    // run again.
    function hydrate(current, item, { remembers = false } = {}) {
        if (item.completes) {
            current.submenus.set(item.id, item);
            const params = paramsOf(current, item.completes);
            return {
                ...item,
                run: () => remembers && remember(item),
                submenu: {
                    icon: item.icon,
                    placeholder: `${PARAMS.titleOf(params, item.completes.param)}…`,
                    ranked: !!PARAMS.choicesOf(params, item.completes.param),
                },
            };
        }
        if (item.reference) return { ...item, run: () => go(current, item, remembers) };
        return { ...item, run: undefined };
    }

    // Run as a person picked it, in front. What it leaves for the person, or why it did not run, is said under the
    // list; with nothing to say the list goes.
    async function go(current, item, remembers) {
        if (remembers) remember(item);
        const { mod, command, args } = item.reference;
        let said = null;
        try {
            const left = await registry.run({ mod, command }, args, { activates: true });
            if (left) said = { text: left, alert: false };
        } catch (error) {
            said = { text: error?.message || String(error), alert: true };
        }
        if (open !== current || current.left) return;
        if (said) current.list.model.say(said.text, { alert: said.alert });
        else current.list.close();
    }

    // The schema of the args of the command `reference` names, or null for one the registry did not list.
    function paramsOf(current, { mod, command }) {
        return current.commands.find((entry) => entry.mod === mod && entry.command === command)?.params ?? null;
    }

    // The rows `extension` answers to `name`, as `row.js` reads them: `[mod, rows]`.
    async function rowsOf(mod, extension, name, ...args) {
        if (typeof extension?.[name] !== 'function') return [mod, []];
        try {
            const rows = await extension[name](...args);
            return [mod, (Array.isArray(rows) ? rows : []).map((row) => ROW.read(mod, row)).filter(Boolean)];
        } catch (error) {
            console.error(`[switcher] ${mod}'s ${name} answered nothing`, error);
            return [mod, []];
        }
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

    // Keyed by what it runs, as an item is made fresh on every open; a read only one has none.
    function keyOf({ reference, completes }) {
        const runs = reference || completes;
        return runs && JSON.stringify([runs.mod, runs.command, runs.args, runs.param ?? null]);
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
