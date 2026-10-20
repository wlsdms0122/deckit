import * as CHANNELS from '../channels/index.js';
import * as DECLARED from './protocol.js';
import * as PAGE from './model/page-name.js';

const PROTOCOL = CHANNELS.bindAll(DECLARED);

// `deckit` is what connect answered, `host` the app's answers.
export function createSwitcher({ PANEL, deckit, host }) {
    // MARK: - Property
    const USE = 'switcher-use';
    const USE_KEPT = 60;
    // Taken round robin up to this, so a mod with many rows loses its last ones rather than crowding others out.
    const NOW_MAX = 3;
    // How long the list waits for slow Now rows before it opens; later ones arrive on their own.
    const NOW_WAIT_MS = 150;
    // An entry that opens a mod is the switcher's own, under an id no mod's entry has.
    const OPEN = '@open:';
    // How long main waits on the list's exit before it goes on.
    const EXIT_LIMIT_MS = 400;
    const state = { view: null, on: false, ready: false, closed: null }; // `closed` resolves the open in progress
    const handed = new Map(); // entry id -> { mod, kind, group, label }, of what the list was given since it opened
    let session = null; // a promise of deckit's commands, asked for this list since it last opened, or of null
    let supplies = 0;

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        deckit.keymap.register({
            action: 'switcher',
            key: 'mod+shift+g',
            label: 'Quick switcher',
            global: true,
            run: (webContents) => host.summonSwitcher(deckit.web.pageFor(webContents) || webContents),
        });
        PROTOCOL.ready.on((_payload, sender) => {
            if (sender !== state.view?.webContents) return;
            state.ready = true;
            // A chord that came while the page was loading is answered now instead of lost.
            if (state.on) PROTOCOL.open.send(sender, {});
        });
        PROTOCOL.close.on((_payload, sender) => sender === state.view?.webContents && close());
        PROTOCOL.need.on((_payload, sender) => sender === state.view?.webContents && supply());
        PROTOCOL.query.on(({ raw, submenu }, sender) => {
            if (sender !== state.view?.webContents) return;
            if (submenu) search(raw, submenu);
            else resolve(raw);
        });
        PROTOCOL.pick.on(({ id }, sender) => sender === state.view?.webContents && pick(id));
    }

    // Resolves true when put away (the keyboard is the host's to give back), false when it never opened or was
    // opened again during its exit.
    function open() {
        return new Promise((resolve) => {
            const view = build();
            state.closed?.(false);
            state.closed = resolve;
            state.on = true;
            view.setVisible(true);
            view.webContents.focus();
            if (state.ready) PROTOCOL.open.send(view.webContents, {});
        });
    }

    // Hidden only after the page has played its exit. Opened again during it, it stays up.
    function close() {
        if (!state.on) return;
        state.on = false;
        const closed = state.closed;
        state.closed = null;
        // Main waits on the exit only so long: a page that is gone or stuck plays none.
        const played = PROTOCOL.dismiss.invoke(state.view.webContents, {}, { timeout: EXIT_LIMIT_MS }).catch(() => {});
        played.then(() => {
            if (state.on) return closed?.(false);
            state.view?.setVisible(false);
            closed?.(true);
        });
    }

    // MARK: - Private
    // Made the first time it is asked for. A page that reloads cannot hold an open list.
    function build() {
        if (state.view) return state.view;
        const view = deckit.pages.make(PAGE.PAGE_NAME);
        const contents = view.webContents;
        deckit.keymap.listen(contents, {
            keys: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => ({
                key: 'mod+' + number,
                run: () => PROTOCOL.number.send(contents, { number }),
            })),
        });
        deckit.log.guard(
            contents,
            'console-message',
            ({ level, message }) => level === 'error' && deckit.log.error(`switcher: ${message}`)
        );
        deckit.log.guard(contents, 'did-start-loading', () => {
            const was = state.ready;
            state.ready = false;
            // Only a page that was up: the first load starts after the first open, which must stay open.
            if (was) drop();
        });
        deckit.log.guard(
            contents,
            'destroyed',
            () => {
                drop();
                state.view = null;
                state.ready = false;
            },
            { once: true }
        );
        view.setBackgroundColor('#00000000');
        view.setVisible(false);
        state.view = view;
        return view;
    }

    // For a page that is going: there is no exit to wait for.
    function drop() {
        if (!state.on) return;
        state.on = false;
        state.view?.setVisible(false);
        const closed = state.closed;
        state.closed = null;
        closed?.(true);
    }

    function list() {
        return state.view?.webContents || null;
    }

    // Every running mod's commands, each mod with a view opened by its name too, and what is happening now. A list
    // opened again asks in a session of its own, and what the last one was handed goes.
    async function supply() {
        const mine = ++supplies;
        session?.then((ended) => ended?.end());
        // Asked at once, so a query typed while it is on its way waits for it.
        session = deckit.commands.session().catch((error) => {
            deckit.log.warn("the switcher could not ask for deckit's commands", error);
            return null;
        });
        handed.clear();
        const current = await session;
        if (!current || mine !== supplies) return;
        const commands = await current.list();
        if (mine !== supplies) return;
        const used = deckit.state.read(USE, {});
        // Each mod's own entry that opens it ahead of its commands.
        const opening = new Map(opens().map((entry) => [entry.mod.id, entry]));
        const items = deckit.mods
            .list()
            .flatMap(({ id }) => [opening.get(id), ...commands.filter((entry) => entry.mod.id === id).map(hand)])
            .filter(Boolean)
            .map((entry) => ({ ...entry, used: frecency(used[keyOf(handed.get(entry.id))]) }));
        const nows = current.now();
        const buckets = nows.map(() => []);
        let late = false;
        const landed = nows.map((rows, index) =>
            rows.then((entries) => {
                buckets[index] = entries.map(hand);
                if (mine === supplies && late && list()) PROTOCOL.now.send(list(), { rows: roundRobin(buckets) });
            })
        );
        await Promise.race([Promise.all(landed), new Promise((done) => setTimeout(done, NOW_WAIT_MS))]);
        late = true;
        if (mine !== supplies || !list()) return;
        PROTOCOL.supply.send(list(), { items, now: roundRobin(buckets), tones: deckit.commands.tones });
    }

    // The mods the panel can put on screen. The mod's names are aliases here, so a prefix of its name still finds
    // it.
    function opens() {
        return deckit.mods
            .list()
            .filter(({ id }) => deckit.mods.runOf(id)?.state === 'running' && PANEL.canBringToFront(id))
            .map((mod) =>
                hand({
                    id: OPEN + mod.id,
                    kind: 'command',
                    label: 'Open ' + mod.name,
                    group: '',
                    hint: '',
                    icon: deckit.mods.listingOf(mod.id).icon,
                    keywords: '',
                    address: '',
                    aliases: [mod.name, ...deckit.mods.listingOf(mod.id).keywords],
                    runnable: true,
                    submenu: null,
                    mod,
                })
            );
    }

    // Each answer is sent as it lands, so a slow resolver holds back nobody. A query no one answers still gets one
    // empty reply: the list shows the last query's entries until it hears otherwise.
    async function resolve(raw) {
        const answers = (await session)?.resolve(raw) || [];
        const gathered = [];
        let left = answers.length;
        const answer = () => list() && PROTOCOL.resolved.send(list(), { raw, entries: gathered });
        if (!left) return answer();
        for (const answering of answers) {
            answering.then((found) => {
                left--;
                gathered.push(...found.map(hand));
                if (found.length || !left) answer();
            });
        }
    }

    // The entries of a submenu, answered by its mod.
    async function search(raw, submenu) {
        const found = await (await session)?.search(submenu, raw);
        if (found && list()) PROTOCOL.resolved.send(list(), { raw, entries: found.map(hand), submenu });
    }

    // Only a command is remembered: a readout or a query's result is not something to run again.
    function pick(id) {
        const entry = handed.get(id);
        if (!entry) return;
        if (entry.kind === 'command') remember(entry);
        if (id.startsWith(OPEN)) return PANEL.bringToFront(entry.mod);
        session
            .then((current) => current?.run(id))
            .catch((error) => deckit.log.warn(`${entry.mod}: a switcher entry failed`, error));
    }

    // An entry as the list is handed it, its mod drawn with the mod's icon and found by its keywords; what it is,
    // kept to remember it by when it is picked.
    function hand(entry) {
        const listing = deckit.mods.listingOf(entry.mod.id);
        handed.set(entry.id, { mod: entry.mod.id, kind: entry.kind, group: entry.group, label: entry.label });
        return {
            ...entry,
            mod: {
                id: entry.mod.id,
                name: entry.mod.name,
                icon: listing?.icon || '',
                aliases: listing?.keywords || [],
            },
        };
    }

    function roundRobin(buckets) {
        const out = [];
        for (let depth = 0; out.length < NOW_MAX; depth++) {
            const round = buckets.filter((bucket) => bucket.length > depth);
            if (!round.length) break;
            for (const bucket of round) if (out.length < NOW_MAX) out.push(bucket[depth]);
        }
        return out;
    }

    // Keyed by mod, group and label, not by an entry's id: commands are made fresh on every open.
    function keyOf({ mod, group, label }) {
        return `${mod}\u0000${group}\u0000${label}`;
    }

    // Too small to outweigh a use, the time only breaks ties, the later first.
    function frecency(use) {
        if (!use) return 0;
        const hours = (Date.now() - use.at) / 3.6e6;
        const weight = hours < 1 ? 4 : hours < 24 ? 2 : hours < 168 ? 1 : hours < 720 ? 0.5 : 0.2;
        return Math.min(use.count, 30) * weight + use.at / 1e15;
    }

    function remember(entry) {
        const used = deckit.state.read(USE, {});
        const key = keyOf(entry);
        used[key] = { count: (used[key]?.count || 0) + 1, at: Date.now() };
        const kept = Object.entries(used)
            .sort((a, b) => frecency(b[1]) - frecency(a[1]))
            .slice(0, USE_KEPT);
        deckit.state.write(USE, Object.fromEntries(kept));
    }

    return {
        start,
        // What the host drives of it.
        control: {
            // Into one of the host app's windows, as deckit places a view (`front`, `bounds`, `onClose`).
            place: (window, options) => deckit.window.place(build(), window, options),
            contains: (webContents) => !!state.view && state.view.webContents === webContents,
            focus: () => state.view?.webContents.focus(),
            open,
            close,
            shown: () => state.on,
            // The chord that summons it now, as a person reads it, or '' when it has none.
            chord: () => deckit.keymap.chordOf('switcher'),
        },
    };
}
