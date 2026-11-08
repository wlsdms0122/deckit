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

// The list of a Show item for each mod the shell can show, the actions mods set, `given`, by the connection of each,
// and the actions mods declare to `switcher/actions`, over an overlay window of its own: `show()` opens it, and
// `toggle()` opens it or puts it away when it is open. Each open reads the mods and their actions anew. It stays until
// the keyboard goes elsewhere: Escape, a mod coming on screen, another app. `end()` drops the list.
// `notifications()` and `commands()` are the owners of deckit/notifications and deckit/commands while one is
// connected, or null. The mods to show and their names are read with deckit.mods: `shell.mods.list()` and `open(id)`,
// and `deckit.mods.list()`.
function switcher(shell, deckit, given, { notifications = () => null, commands = () => null } = {}) {
    const records = deckit.storage.records;
    const drawing = { ui: shell.ui, theme: shell.theme, util: deckit.util }; // what the list is drawn and ranked with
    let open = null; // the list on screen, or on its way: { list, window, about, submenus }

    return { show, toggle, putAway, end };

    function toggle() {
        if (open) return putAway();
        show();
    }

    // The window comes once the list is drawn over it, and goes with it: the two are one thing on screen. A window that
    // closes or resigns key where the list did not ask takes the list with it.
    async function show() {
        if (open) return;
        const current = { list: null, window: null, about: null, submenus: new Map() };
        open = current;
        let supplied;
        try {
            supplied = await supply(current);
        } catch (error) {
            console.error('[switcher] the actions could not be read', error);
        }
        if (open !== current) return;
        if (!supplied) return putAway();
        current.list = LIST.open(drawing, {
            placeholder: 'Run an action or show a mod…',
            items: supplied.items,
            now: supplied.now,
            onQuery: (raw, submenu) => search(current, raw, submenu),
            onClose: () => open === current && putAway(),
        });
        current.window = shell.windows.open({
            name: 'main',
            content: document.createElement('div'),
            level: 'overlay',
            width: 600,
            height: 400,
            didResignKey: () => open === current && putAway(),
            didClose: () => {
                current.window = null;
                if (open === current) putAway();
            },
        });
        supplied.later.then((items) => open === current && current.list.model.setNow(items));
    }

    function putAway() {
        if (!open) return;
        const current = open;
        open = null;
        current.list?.close();
        current.window?.close();
    }

    function end() {
        open = null;
    }

    // The listed actions with the Show items, and what is happening now. `later` is the Now strip as the slow mods
    // land in it.
    async function supply(current) {
        const sources = currentSources();
        const listing = Promise.all(
            sources.map(async ([mod, source]) => [mod, (await actionsOf(mod, source, 'list')) || []])
        );
        const shown = shell.mods.list();
        const actions = [...(await listing), ...(await declared())];
        current.about = {
            names: new Map((await deckit.mods.list()).found.map(({ id, name }) => [id, name])),
            iconOf: shell.iconOf,
        };
        const used = records.get(USE, {});
        const listed = ITEMS.listed({ actions, shown, about: current.about });
        const items = listed.map((item) => hydrate(current, { ...item, used: frecency(used[keyOf(item)]) }, true));
        const buckets = [];
        const landed = sources.map(([mod, source], index) =>
            actionsOf(mod, source, 'now')
                .then((actions) => (actions || []).map((each) => ITEMS.itemOf('now', mod, each, current.about)))
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
        const sources = currentSources().filter(([mod]) => !parent || mod === parent.mod);
        const gathered = [];
        let left = sources.length;
        let heard = false;
        const answer = () => open === current && current.list?.model.setResolved(raw, gathered, submenu);
        if (!left) return answer();
        for (const [mod, source] of sources)
            actionsOf(mod, source, 'search', raw, parent ? parent.value : null)
                .then((actions) => actions?.map((each) => ITEMS.itemOf(parent?.id ?? raw, mod, each, current.about)))
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
        if (item.shows || item.command || item.value !== null)
            return { ...item, run: () => go(current, item, remembers) };
        return { ...item, run: undefined };
    }

    // Run as a person picked it: a Show item by the shell, an action by its mod, which asks to come on screen where it
    // means to. Its row shows it running, then done or failed, with what it leaves for the person, or why it did not
    // run, under the list. The list goes only as the keyboard does; an action that failed once it had gone says why
    // in a notification.
    async function go(current, item, remembers) {
        if (remembers) remember(item);
        current.list.model.mark(item, 'running');
        let said = null;
        try {
            const left = item.shows
                ? await shell.mods.open(item.shows)
                : item.command
                  ? await commandsOwner().run(item.mod, item.command, item.args)
                  : await sourceOf(item.mod).run(item.value);
            if (typeof left === 'string' && left) said = { text: left, alert: false };
        } catch (error) {
            said = { text: error?.message || String(error), alert: true };
        }
        if (open !== current) {
            if (said?.alert) notify(item, said.text);
            return;
        }
        current.list.model.mark(item, said?.alert ? 'failed' : 'done');
        if (said) current.list.model.say(said.text, { alert: said.alert });
    }

    // Posted to deckit/notifications, with nothing to bring forward; while no owner is connected it is only logged.
    function notify(item, why) {
        const owner = notifications();
        const posted = owner
            ? owner.post({ title: item.label, body: why })
            : Promise.reject(new Error('no mod shows notifications'));
        posted.catch((error) => console.error(`[switcher] ${item.label} did not run: ${why}`, error));
    }

    // What each mod set, `[mod id, { list, now, search, run }]`.
    function currentSources() {
        return [...given].map(([connection, source]) => [connection.credential.mod, source]);
    }

    function commandsOwner() {
        const owner = commands();
        if (!owner) throw new Error('No mod runs commands now');
        return owner;
    }

    function sourceOf(mod) {
        const source = currentSources().find(([id]) => id === mod)?.[1];
        if (typeof source?.run !== 'function') throw new Error(`${mod} has no actions now`);
        return source;
    }

    // What mods declare to `switcher/actions`, `[mod id, actions]` for each mod in turn, as `action.js` reads them:
    // none while the switcher does not own it.
    async function declared() {
        let handed = [];
        try {
            handed = await deckit.exports.contributions('switcher/actions');
        } catch (error) {
            if (error?.kind !== 'NOT_OWNER') console.error('[switcher] the declared actions could not be read', error);
        }
        const byMod = new Map();
        for (const contribution of handed) {
            const action = ACTION.readDeclared(contribution);
            if (!action) continue;
            if (!byMod.has(contribution.mod.id)) byMod.set(contribution.mod.id, []);
            byMod.get(contribution.mod.id).push(action);
        }
        return [...byMod];
    }

    // The actions `source` answers to `name`, as `action.js` reads them, or null where it answers null.
    async function actionsOf(mod, source, name, ...args) {
        if (typeof source?.[name] !== 'function') return [];
        try {
            const actions = await source[name](...args);
            if (actions === null) return null;
            return (Array.isArray(actions) ? actions : []).map(ACTION.read).filter(Boolean);
        } catch (error) {
            console.error(`[switcher] ${mod}'s ${name} answered nothing`, error);
            return [];
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

    // Keyed by what it runs, as an item is made fresh on every open: a mod gives an action the same value each time,
    // and a declared one names the same command and args.
    function keyOf({ mod, value, command, args, shows }) {
        return JSON.stringify(shows ? [ITEMS.SHOWN_BY, shows] : command ? [mod, { command, args }] : [mod, value]);
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
