const { matchFields } = require('deckit-sdk/match');

// The forge session the Forge views show, one for all of them: each session is a daemon of its own, and there may be
// many. It is chosen from a pop-up button in the title bar, each session marked with its state, or by a command.
// The chosen session is asked about as often as the views ask about it; the list less often.
const CURRENT_MS = 3000;
const LIST_MS = 15000;

const sessionPicker = ({ shell, deckit, forge, onChange }) => {
    const { ui } = shell;
    const store = deckit.storage.values;
    let session = store.get('session', null) || 'default';
    let sessions = [{ name: session, checking: true }]; // until the first answer
    let timers = [];
    let asked = 0;

    const stateOf = (entry) =>
        entry.checking ? 'checking' : !entry.up ? 'stopped' : entry.authority ? 'running' : 'started elsewhere';
    // Drawn in the ink's custom property, so it follows the surface it is on (glass in the select's menu).
    const dot = (entry) => {
        const ink = entry.checking ? 'muted' : entry.up ? 'ok-ink' : 'alert-ink';
        return ui.iconOf(`<circle cx="12" cy="12" r="5" style="fill: var(--deckit-${ink})"/>`, {
            size: 14,
            color: 'none',
        });
    };
    const button = ui.select({ options: [], value: session, onChange: (name) => choose(name) });
    button.element.title = 'Forge session';
    const paint = () => {
        button.setOptions(
            sessions.map((entry) => ({ value: entry.name, label: entry.name, icon: dot(entry), hint: stateOf(entry) }))
        );
        button.set(session);
    };

    const choose = (name) => {
        if (name === session) return;
        session = name;
        store.set('session', name);
        paint();
        onChange(name);
    };

    // What a session is now, as asked here or by a view that showed it, so the two never disagree.
    const told = (entry) => {
        sessions = sessions.map((each) => (each.name === entry.name ? entry : each));
        paint();
    };
    // A session that could not be asked about is not running, as the views say.
    const unknown = (name) => ({ name, up: false, authority: false });

    // The sessions there are now; one chosen that is gone gives way to the main one.
    const load = async () => {
        const mine = ++asked;
        const answer = await forge.sessions().catch(() => null);
        if (mine !== asked) return sessions;
        if (!answer) {
            for (const entry of sessions) if (entry.checking) told(unknown(entry.name));
            return sessions;
        }
        sessions = answer.sessions || [];
        if (!sessions.some((entry) => entry.name === session)) choose(answer.main);
        paint();
        return sessions;
    };
    const loadCurrent = async () => {
        const mine = asked;
        const name = session;
        const entry = await forge.session(name).catch(() => unknown(name));
        if (mine !== asked || name !== session) return;
        told(entry);
    };
    paint();

    return {
        element: button.element,
        current: () => session,
        choose,
        told,
        show: () => {
            load();
            for (const timer of timers) clearInterval(timer);
            timers = [setInterval(loadCurrent, CURRENT_MS), setInterval(load, LIST_MS)];
        },
        hide: () => {
            for (const timer of timers) clearInterval(timer);
            timers = [];
        },
        // Whether `name` is a session there is, asked again.
        exists: async (name) => (await load()).some((entry) => entry.name === name),
        // The sessions there are, as values of a command's arg, each with its state, ranked for `partial` by name.
        candidates: async (partial) => {
            const listed = (await load()).map((entry) => ({
                value: entry.name,
                title: entry.name,
                hint: stateOf(entry),
                keywords: [],
            }));
            if (!partial.trim()) return listed;
            return listed
                .map((candidate) => ({
                    candidate,
                    found: matchFields([{ text: candidate.title, name: true }], partial),
                }))
                .filter(({ found }) => found)
                .sort((left, right) => right.found.tier - left.found.tier || right.found.score - left.found.score)
                .map(({ candidate }) => candidate);
        },
    };
};

module.exports = { sessionPicker };
