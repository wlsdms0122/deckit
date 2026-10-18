const { supervisorView } = require('./forge/supervisor.js');
const { workflowsView } = require('./forge/workflows.js');
const { schedulesView } = require('./forge/schedules.js');
const { sessionPicker } = require('./forge/session-picker.js');
const { brainView } = require('./llmemory/brain.js');

module.exports = {
    keywords: [
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
    ],

    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`,

    settings: {
        home: {
            label: "The bot's folder",
            type: 'text',
            default: '~/workspace/agent/jineun-bot',
            placeholder: '~/workspace/agent/jineun-bot',
            hint: 'Where the bot is: its bin/forge and bin/llmemory, .forge and bot/brain.',
        },
        wrapCode: {
            label: 'Wrap code in notes',
            type: 'toggle',
            default: false,
            hint: "Long lines in a note's code blocks wrap instead of scrolling sideways. The wrap button on a block switches it too.",
        },
    },

    async start(deck) {
        const { ui } = deck;
        const store = deck.storage.values;
        const bot = await deck.mainProcess('main-process/bot.js');
        await bot.use(deck.settings.get('home'));

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
        const head = document.createElement('div');
        Object.assign(head.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flex: '0 0 auto',
            padding: '10px 14px 8px',
            minHeight: '30px',
        });
        ui.titleBar(head);

        const reveal = (key) => () => {
            deck.show();
            setMode(key);
        };
        const picker = sessionPicker({
            deck,
            bot,
            reveal: () => {
                deck.show();
                if (mode.system !== 'Forge') setMode('supervisor');
            },
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
                view: supervisorView({ deck, bot, picker, reveal: reveal('supervisor') }),
            },
            {
                key: 'workflows',
                system: 'Forge',
                label: 'Workflows',
                icon: 'list',
                view: workflowsView({ deck, bot, picker, reveal: reveal('workflows') }),
            },
            {
                key: 'schedules',
                system: 'Forge',
                label: 'Schedules',
                icon: 'calendar',
                view: schedulesView({ deck, bot, picker, reveal: reveal('schedules') }),
            },
            {
                key: 'brain',
                system: 'LLMemory',
                label: 'Brain',
                icon: 'search',
                view: brainView({ deck, bot, reveal: reveal('brain') }),
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

        const title = document.createElement('div');
        Object.assign(title.style, { flex: '0 0 auto', font: '700 15px var(--deckit-font)' });
        head.append(title, picker.element, ...MODES.map((entry) => entry.view.bar));
        content.append(head, ...MODES.map((entry) => entry.view.pane));

        const setMode = (key) => {
            const next = modeOf(key);
            if (visible && next !== mode) hide();
            mode = next;
            store.set('mode', mode.key);
            title.textContent = mode.label;
            renderNav();
            for (const entry of MODES) {
                const on = entry === mode;
                entry.view.bar.style.display = on ? 'flex' : 'none';
                entry.view.pane.style.display = on ? 'flex' : 'none';
                if (entry.view.side) entry.view.side.style.display = on ? 'flex' : 'none';
            }
            picker.element.style.display = mode.system === 'Forge' ? '' : 'none';
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
        const workflows = modeOf('workflows').view;
        const schedules = modeOf('schedules').view;

        deck.view({
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
        deck.keys({
            services: { key: 'mod+1', label: 'Services', run: () => setMode('supervisor') },
            brain: { key: 'mod+2', label: 'Brain', run: () => setMode('brain') },
            workflows: { key: 'mod+3', label: 'Workflows', run: () => setMode('workflows') },
            schedules: { key: 'mod+4', label: 'Schedules', run: () => setMode('schedules') },
            searchBrain: { key: 'mod+f', label: 'Search the brain', run: () => setMode('brain') },
            brainBack: {
                key: 'mod+[',
                label: 'Brain · Back',
                run: () => {
                    if (mode.key === 'brain') brain.back();
                },
            },
        });
        deck.now(supervisor.now);
        deck.commands(() => [
            ...brain.commands(),
            ...supervisor.commands(),
            ...workflows.commands(),
            ...schedules.commands(),
            ...picker.commands(),
        ]);
        deck.settings.on((key, value) => {
            if (key === 'home') bot.use(value).then(() => brain.reload());
        });
        deck.exports({ forge: { tasks: bot.forge.tasks, release: bot.forge.release } });

        for (const name of ['tasks', 'release']) bot.on(name, (state) => deck.emit(name, state));
    },
};
