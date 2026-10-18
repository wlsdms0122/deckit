// The forge session the Forge views show, one for all of them: each session is a daemon of its own, and there may be
// many. It is chosen from a pop-up button in the title bar, each session marked running or not, or from the switcher.
// The chosen session is asked about as often as the views ask about it; the list, a command for each session, less often.
const CURRENT_MS = 3000;
const LIST_MS = 15000;

const sessionPicker = ({ deck, bot, reveal, onChange }) => {
    const { theme, ui } = deck;
    const store = deck.storage.values;
    let session = store.get('session', null) || 'default';
    let sessions = [{ name: session, checking: true }]; // until the first answer
    let timers = [];
    let asked = 0;

    const stateOf = (entry) =>
        entry.checking ? 'checking' : !entry.up ? 'stopped' : entry.authority ? 'running' : 'started elsewhere';
    const dot = (entry) =>
        ui.iconOf('<circle cx="12" cy="12" r="5"/>', {
            size: 14,
            fill: entry.checking ? theme.color.muted : entry.up ? theme.color.ok : theme.color.alert,
            color: 'none',
        });
    const button = ui.select({ options: [], value: session, onChange: (name) => choose(name) });
    button.element.title = 'Forge session';
    const paint = () => {
        button.setOptions(
            sessions.map((entry) => ({ value: entry.name, label: entry.name, icon: dot(entry), hint: stateOf(entry) }))
        );
        button.set(session);
    };
    theme.onChange(paint);

    const choose = (name) => {
        if (name === session) return;
        session = name;
        store.set('session', name);
        paint();
        onChange(name);
    };

    // The sessions there are now; one chosen that is gone gives way to the bot's own.
    const load = async () => {
        const mine = ++asked;
        const answer = await bot.forge.supervisor.sessions().catch(() => null);
        if (!answer || mine !== asked) return sessions;
        sessions = answer.sessions || [];
        if (!sessions.some((entry) => entry.name === session)) choose(answer.main);
        paint();
        return sessions;
    };
    const loadCurrent = async () => {
        const mine = asked;
        const name = session;
        const entry = await bot.forge.supervisor.session(name).catch(() => null);
        if (!entry || mine !== asked || name !== session) return;
        sessions = sessions.map((each) => (each.name === name ? entry : each));
        paint();
    };
    paint();

    return {
        element: button.element,
        current: () => session,
        choose,
        show: () => {
            load();
            for (const timer of timers) clearInterval(timer);
            timers = [setInterval(loadCurrent, CURRENT_MS), setInterval(load, LIST_MS)];
        },
        hide: () => {
            for (const timer of timers) clearInterval(timer);
            timers = [];
        },
        commands: () => [
            {
                label: 'Forge Session',
                hint: `Choose which daemon the Forge views show · now ${session}`,
                icon: ui.icon('server', { size: 16 }),
                group: 'Forge',
                keywords: ['forge', 'session', 'daemon', '세션', '데몬'],
                page: {
                    placeholder: 'Choose a forge session',
                    entries: async () =>
                        (await load()).map((entry) => ({
                            label: entry.name,
                            hint: stateOf(entry),
                            icon: dot(entry),
                            run: () => {
                                choose(entry.name);
                                reveal();
                            },
                        })),
                },
            },
        ],
    };
};

module.exports = { sessionPicker };
