const { supervisorView } = require('./forge/services/supervisor.js');
const { workflowsView } = require('./forge/workflows/workflows.js');
const { schedulesView } = require('./forge/schedules/schedules.js');
const { sessionPicker } = require('./forge/sessions/session-picker.js');
const { brainView } = require('./llmemory/brain.js');
const { switcher, inFront } = require('./switcher/switcher.js');

// The settings that say where llmemory and the brain are, handed to the main process together.
const PLACES = ['llmemory', 'brain'];

// What Bot calls on `forge/sessions`.
const FORGE = ['sessions', 'session', 'start', 'stop', 'restart', 'log', 'call', 'dispatch', 'runSchedule', 'run'];

class Bot {
    // What attach has put on screen for the commands and reopen() to reach, while it is attached: `openWindow()` opens
    // Bot's window, or orders it front where it is open.
    screen = null;

    // The commands its manifest declares to `deckit/commands`, run from the exports for its id. Each acts on the
    // window's views, `show` bringing the window in front, and one run while Bot is not attached says so.
    start(deckit) {
        const onScreen = () => {
            if (!this.screen) throw new Error('Bot has no window to open');
            return this.screen;
        };
        const commands = {
            show: (args) => onScreen().show(args),
            'choose-session': (args) => onScreen().chooseSession(args),
            'search-brain': (args) => onScreen().searchBrain(args),
            'read-note': (args) => onScreen().readNote(args),
        };
        deckit.exports.register({
            connect: () => ({
                runCommand: async (id, args) => {
                    if (!Object.hasOwn(commands, id)) throw new Error(`Bot has no command ${id}`);
                    await commands[id](args ?? {});
                },
            }),
        });
    }

    async attach(shell, deckit, { mainProcess }) {
        const { ui } = shell;
        const store = deckit.storage.values;
        const forge = forgeOf();
        const settings = settingsOf();
        const bot = await mainProcess.start('main-process/bot/bot.js');
        const places = () => Object.fromEntries(PLACES.map((key) => [key, settings.get(key)]));
        // An address in a note opens through `deckit/urls`; one asked while it is not connected is logged.
        let urls = null;
        const openURL = async (url) => {
            if (urls) return urls.open(url);
            console.warn(`[bot] ${url} did not open: deckit/urls is not connected`);
            return false;
        };

        const content = document.createElement('div');
        Object.assign(content.style, {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            color: 'var(--deckit-text)',
            font: 'var(--deckit-type-body)',
            overflow: 'hidden',
        });
        // The kit's title bar, one height for every view, so nothing in it moves when the view changes.
        const head = document.createElement('div');
        ui.titleBar(head);

        const picker = sessionPicker({
            shell,
            deckit,
            forge,
            onChange: (name) => {
                for (const entry of MODES) if (entry.system === 'Forge') entry.view.setSession(name);
            },
        });
        const SYSTEMS = [
            { name: 'Forge', icon: 'anvil' },
            { name: 'LLMemory', icon: 'brain' },
        ];
        const MODES = [
            {
                key: 'supervisor',
                system: 'Forge',
                label: 'Services',
                icon: 'server',
                view: supervisorView({ shell, deckit, forge, picker }),
            },
            {
                key: 'workflows',
                system: 'Forge',
                label: 'Workflows',
                icon: 'list',
                hint: 'Browse, run and cancel Forge workflows',
                view: workflowsView({ shell, deckit, forge, picker }),
            },
            {
                key: 'schedules',
                system: 'Forge',
                label: 'Schedules',
                icon: 'calendar',
                hint: 'Manage Forge workflow schedules',
                view: schedulesView({ shell, deckit, forge, picker }),
            },
            {
                key: 'brain',
                system: 'LLMemory',
                label: 'Brain',
                icon: 'brain',
                view: brainView({ shell, deckit, bot, settings, openURL }),
            },
        ];
        const modeOf = (key) => MODES.find((entry) => entry.key === key) || MODES[0];
        let mode = modeOf(store.get('mode', MODES[0].key));
        let visible = false;

        const sidebar = document.createElement('div');
        Object.assign(sidebar.style, { display: 'flex', flexDirection: 'column', minHeight: '0', flex: '1 1 auto' });
        const folds = () => store.get('folds', {});
        const setFold = (key, on) => store.set('folds', { ...folds(), [key]: on });
        const navRows = new Map();
        const navRow = (entry) => {
            const row = ui.row({ glyph: ui.icon(entry.icon, { size: 16 }) });
            const label = document.createElement('span');
            label.textContent = entry.label;
            Object.assign(label.style, {
                flex: '1 1 auto',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            });
            row.element.append(label);
            row.element.addEventListener('click', () => setMode(entry.key));
            navRows.set(entry.key, row);
            return row.element;
        };
        for (const system of SYSTEMS) {
            const section = ui.section({
                label: system.name,
                icon: ui.icon(system.icon, { size: 16 }),
                collapsed: !!folds()[system.name],
                onToggle: (on) => {
                    setFold(system.name, on);
                    section.setCollapsed(on);
                },
            });
            const list = ui.list({ role: 'listbox', name: system.name, key: (entry) => entry.key, create: navRow });
            list.set(MODES.filter((entry) => entry.system === system.name));
            section.body.append(list.element);
            sidebar.append(section.element);
        }
        sidebar.append(...MODES.filter((entry) => entry.view.side).map((entry) => entry.view.side));
        const renderNav = () => {
            for (const [key, row] of navRows) row.setActive(key === mode.key);
        };

        // Every view's name in one cell, the one shown over the others, so the title is as wide as the longest and
        // what follows it starts at one place.
        const title = document.createElement('div');
        title.className = 'deckit-title-bar-title';
        Object.assign(title.style, { flex: '0 0 auto', display: 'grid', marginRight: '8px' });
        const names = new Map(
            MODES.map((entry) => {
                const name = document.createElement('span');
                name.textContent = entry.label;
                name.style.gridArea = '1 / 1';
                title.append(name);
                return [entry, name];
            })
        );
        head.append(title, picker.element, ...MODES.map((entry) => entry.view.bar));
        content.append(head, ...MODES.map((entry) => entry.view.pane));

        const setMode = (key) => {
            const next = modeOf(key);
            if (visible && next !== mode) hide();
            mode = next;
            store.set('mode', mode.key);
            renderNav();
            for (const entry of MODES) {
                const on = entry === mode;
                names.get(entry).style.visibility = on ? '' : 'hidden';
                entry.view.bar.style.display = on ? 'flex' : 'none';
                entry.view.pane.style.display = on ? 'flex' : 'none';
                if (entry.view.side) entry.view.side.style.display = on ? 'flex' : 'none';
            }
            picker.element.style.visibility = mode.system === 'Forge' ? '' : 'hidden';
            if (visible) show();
        };
        const show = () => {
            if (mode.system === 'Forge') picker.show();
            mode.view.show();
        };
        const hide = () => {
            picker.hide();
            mode.view.hide?.();
        };
        setMode(mode.key);

        const supervisor = modeOf('supervisor').view;
        const brain = modeOf('brain').view;

        // The window's own keys, while it is key: ⌘ and a key, matched on the physical key.
        const KEYS = {
            Digit1: () => setMode('supervisor'),
            Digit2: () => setMode('brain'),
            Digit3: () => setMode('workflows'),
            Digit4: () => setMode('schedules'),
            KeyF: () => setMode('brain'),
            BracketLeft: () => mode.key === 'brain' && brain.back(),
        };
        const onKey = (event) => {
            if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
            if (!Object.hasOwn(KEYS, event.code)) return;
            event.preventDefault();
            KEYS[event.code]();
        };
        const listenKeys = (on) => {
            if (on) content.ownerDocument.addEventListener('keydown', onKey);
            else content.ownerDocument.removeEventListener('keydown', onKey);
        };

        // The views beside the sidebar that picks them, whose width and fold are kept as the person leaves them.
        const split = ui.splitView({
            sidebar,
            content,
            ...store.get('sidebar', {}),
            onChange: (kept) => store.set('sidebar', kept),
        });
        const openWindow = () =>
            shell.windows.open({
                name: 'main',
                content: split.element,
                didAppear: () => {
                    visible = true;
                    show();
                },
                didBecomeKey: () => listenKeys(true),
                didResignKey: () => listenKeys(false),
                didDisappear: () => {
                    visible = false;
                    hide();
                },
            });
        openWindow();
        const actions = switcher({
            ui,
            modes: MODES,
            supervisor,
            picker,
            brain,
            show: openWindow,
            does: {
                ...inFront({
                    show: showView,
                    'restart-forge': () => {
                        setMode('supervisor');
                        return supervisor.restart();
                    },
                    'search-brain': searchBrain,
                    'read-note': readNote,
                    'brain-back': brainBack,
                }),
                'choose-session': async ({ session }, { ready }) => {
                    await chooseSession({ session });
                    ready();
                    if (mode.system !== 'Forge') setMode('supervisor');
                },
            },
        });
        deckit.dependencies.onConnect('switcher/actions', (quickSwitcher) => quickSwitcher.setActions(actions));
        deckit.dependencies.onConnect('forge/sessions', (sessions) => forge.connect(sessions));
        deckit.dependencies.onConnect('deckit/urls', (connected) => {
            urls = connected;
            return () => {
                if (urls === connected) urls = null;
            };
        });
        settings.on((key) => {
            if (PLACES.includes(key))
                bot.use(places()).then((renewed) => {
                    if (renewed) brain.reload();
                });
        });
        deckit.dependencies.onConnect('deckit/configuration', (configuration) => settings.connect(configuration));
        this.screen = {
            openWindow,
            show: (args) => {
                showView(args);
                openWindow();
            },
            chooseSession,
            searchBrain,
            readNote,
        };

        function showView({ view, session }) {
            if (!MODES.some((entry) => entry.key === view)) throw new Error(`Bot has no view ${view}`);
            if (session) picker.choose(session);
            setMode(view);
        }

        async function chooseSession({ session }) {
            if (!(await picker.exists(session))) throw new Error(`There is no forge session ${session}`);
            picker.choose(session);
        }

        function searchBrain({ query }) {
            setMode('brain');
            brain.find(query);
        }

        function readNote({ note }) {
            setMode('brain');
            brain.read(note);
        }

        function brainBack() {
            if (mode.key !== 'brain') throw new Error('Brain is not shown');
            brain.back();
        }
    }

    // Its Dock item pressed while its window is closed.
    reopen() {
        this.screen?.openWindow();
    }

    detach() {
        this.screen = null;
    }
}

module.exports = Bot;

// What Bot calls on `forge/sessions`, the members of FORGE, held while Forge is connected: `connect(sessions)` hands
// them over, and answers what lets them go. A call while none is held rejects, as one forge does not answer does, and
// the views show it so.
function forgeOf() {
    let held = null;
    const forge = Object.fromEntries(
        FORGE.map((name) => [
            name,
            async (...args) => {
                if (!held) throw new Error('Forge is not connected');
                return held[name](...args);
            },
        ])
    );
    forge.connect = (sessions) => {
        held = sessions;
        return () => {
            if (held === sessions) held = null;
        };
    };
    return forge;
}

// Bot's settings as `deckit/configuration` last told them, read at once by the views: `get(key)`, `set(key, value)`
// while it is connected, and `on(listener)`, which hears each key as it changes and every key as they are first read.
// `connect(configuration)` hands the interface over, and answers what lets it go; what was read stays.
function settingsOf() {
    let configuration = null;
    let values = {};
    const listeners = new Set();
    const tell = (key) => {
        for (const listener of listeners) listener(key);
    };
    return {
        get: (key) => values[key],
        set: (key, value) => configuration?.set(key, value),
        on: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        connect: async (given) => {
            configuration = given;
            await given.onChange((key, value) => {
                if (configuration !== given) return;
                values = { ...values, [key]: value };
                tell(key);
            });
            values = await given.values();
            for (const key of Object.keys(values)) tell(key);
            return () => {
                if (configuration === given) configuration = null;
            };
        },
    };
}
