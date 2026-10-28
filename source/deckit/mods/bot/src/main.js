const { supervisorView } = require('./forge/services/supervisor.js');
const { workflowsView } = require('./forge/workflows/workflows.js');
const { schedulesView } = require('./forge/schedules/schedules.js');
const { sessionPicker } = require('./forge/sessions/session-picker.js');
const { brainView } = require('./llmemory/brain.js');
const { switcher, inFront } = require('./switcher/switcher.js');

// The configuration keys that say where llmemory and the brain are, handed to the main process together.
const PLACES = ['llmemory', 'brain'];

class Bot {
    static keywords = [
        'bot',
        'forge',
        'daemon',
        'supervisor',
        'runner',
        'service',
        'llmemory',
        'brain',
        'memory',
        '봇',
        '데몬',
        '서비스',
        '러너',
        '브레인',
        '기억',
        '지식',
    ];

    static icon = `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`;

    static configuration = {
        llmemory: {
            type: 'string',
            title: 'LLMemory command',
            description:
                "Where the llmemory program is, as a full path. Empty: the llmemory on your login shell's PATH.",
            default: '',
        },
        brain: {
            type: 'string',
            title: 'Brain folder',
            description: "The brain's folder, the one llmemory reads with --home. Brain lists nothing until it is set.",
            default: '',
        },
        wrapCode: {
            type: 'boolean',
            title: 'Wrap code in notes',
            description:
                "Long lines in a note's code blocks wrap instead of scrolling sideways. " +
                'The wrap button on a block switches it too.',
            default: false,
        },
    };

    static form = {
        llmemory: { placeholder: 'llmemory' },
        brain: { placeholder: 'Not set' },
    };

    async attach(shell, deckit) {
        const { ui } = shell;
        const store = deckit.storage.values;
        const { forge } = deckit.dependencies;
        const bot = await deckit.mainProcess('main-process/bot/bot.js');
        const places = () => Object.fromEntries(PLACES.map((key) => [key, deckit.configuration.get(key)]));
        await bot.use(places());

        const content = document.createElement('div');
        Object.assign(content.style, {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            color: 'var(--deckit-text)',
            font: '14px var(--deckit-font)',
            overflow: 'hidden',
        });
        // One height for every view, room for its tallest control (or the window's title bar, where taller), so
        // nothing in it moves when the view changes.
        const head = document.createElement('div');
        Object.assign(head.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flex: '0 0 auto',
            padding: '10px 14px 8px',
            height: '48px',
        });
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
                icon: 'search',
                view: brainView({ shell, deckit, bot }),
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
            const row = ui.row();
            const glyph = document.createElement('span');
            glyph.innerHTML = ui.icon(entry.icon, { size: 16 });
            Object.assign(glyph.style, {
                display: 'flex',
                flex: '0 0 auto',
                color: `color-mix(in srgb, var(--deckit-text) 75%, var(--deckit-background))`,
            });
            const label = document.createElement('span');
            label.textContent = entry.label;
            Object.assign(label.style, {
                flex: '1 1 auto',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            });
            row.element.append(glyph, label);
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
            const list = ui.list({ key: (entry) => entry.key, create: navRow });
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
        Object.assign(title.style, { flex: '0 0 auto', display: 'grid', font: '700 15px var(--deckit-font)' });
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

        shell.view.register({
            content,
            sidebar,
            didAppear: () => {
                visible = true;
                show();
            },
            didDisappear: () => {
                visible = false;
                hide();
            },
        });
        deckit.commands.register({
            show: {
                description: 'Shows Bot on Services, Workflows, Schedules or Brain, a Forge view on the session given.',
                params: {
                    type: 'object',
                    properties: {
                        view: {
                            type: 'string',
                            title: 'View',
                            oneOf: MODES.map((entry) => ({ const: entry.key, title: entry.label })),
                        },
                        session: {
                            type: 'string',
                            title: 'Forge session',
                            description: 'The session the Forge views show. Absent: the one chosen.',
                        },
                    },
                    required: ['view'],
                },
                run: (args) => {
                    showView(args);
                    shell.show();
                },
            },
            'choose-session': {
                description: 'Chooses which daemon the Forge views show.',
                params: {
                    type: 'object',
                    properties: { session: { type: 'string', title: 'Forge session' } },
                    required: ['session'],
                },
                run: chooseSession,
                complete: (_param, partial) => picker.candidates(partial),
            },
            'restart-forge': {
                description: "Restarts the chosen session's daemon with the services it supervises, or starts it.",
                run: () => supervisor.restart(),
            },
            'search-brain': {
                description: 'Lists the notes of the brain that match a search, in Brain.',
                params: {
                    type: 'object',
                    properties: { query: { type: 'string', title: 'Search' } },
                    required: ['query'],
                },
                run: searchBrain,
            },
            'read-note': {
                description: 'Opens a note of the brain in Brain.',
                params: {
                    type: 'object',
                    properties: { note: { type: 'string', title: 'Note' } },
                    required: ['note'],
                },
                run: readNote,
                complete: (_param, partial, { signal }) => brain.notesFor(partial, { signal }),
            },
        });
        const viewKey = (view, key) => ({ label: modeOf(view).label, key, run: () => showView({ view }) });
        deckit.keys.register({
            services: viewKey('supervisor', 'mod+1'),
            brain: viewKey('brain', 'mod+2'),
            workflows: viewKey('workflows', 'mod+3'),
            schedules: viewKey('schedules', 'mod+4'),
            searchBrain: { label: 'Search the brain', key: 'mod+f', run: () => showView({ view: 'brain' }) },
            brainBack: { label: 'Back to the Note Before', key: 'mod+[', run: brainBack },
        });
        const actions = switcher({
            ui,
            modes: MODES,
            supervisor,
            picker,
            brain,
            show: shell.show,
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
        deckit.dependencies.onConnect('switcher', (quickSwitcher) => quickSwitcher.setActions(actions));

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

        deckit.configuration.on((key) => {
            if (PLACES.includes(key))
                bot.use(places()).then((renewed) => {
                    if (renewed) brain.reload();
                });
        });
    }
}

module.exports = Bot;
