const { chip } = require('../../chip/chip.js');
const { section } = require('../section/section.js');

// The words of a run's state, as the Activity section shows it.
const STATE_WORDS = { launching: 'Starting', running: 'Running', terminating: 'Stopping' };
// How often the time a mod has run for is drawn again while the section is in the page.
const TICK_MS = 30000;

// The Activity section: every mod running now, an app or not, its run's state, how long it has run and what
// is wrong with it, with a quit and a restart; and the background list, each mod whose manifest asks to run in the
// background, with its reason, each row led by the mod's app icon. `mods` is deckit.mods; `icons` the mods' app icons;
// `onInterfaces()` shows the Interfaces section.
function activitySection({ ui, mods, icons, onInterfaces }) {
    const TITLE = 'Activity';
    // The glyph beside the title in the sidebar.
    const GLYPH = 'server';
    const KEYWORDS = ['활동', '실행', '백그라운드', 'activity', 'running', 'quit', 'background'];
    const DESCRIPTION =
        'The mods running now, apps or not, and for how long. Quit one, or restart it. Below, the mods ' +
        'that run in the background, which start with the app, and why each asks to.';

    const runFills = new WeakMap(); // run row -> its fill(mod)
    const backgroundFills = new WeakMap(); // background row -> its fill(mod)
    const refusals = new Map(); // mod id -> why deckit refused what was last asked of it here
    // what deckit.mods.list(), runs() and interfaces() last answered
    let listed = { list: [], runs: [], interfaces: [] };

    ui.addStyle(`
        .settings-activity-row { display: flex; align-items: flex-start; gap: 8px; padding: 6px 12px; }
        .settings-activity-words { display: flex; flex: 1 1 auto; flex-direction: column; gap: 1px; min-width: 0; }
        .settings-activity-name { display: flex; align-items: center; gap: 6px; font: var(--deckit-type-body); }
        .settings-activity-why { color: var(--deckit-muted); font: var(--deckit-type-small); }
        .settings-activity-problem {
            color: var(--deckit-alert-ink);
            font: var(--deckit-type-small);
            white-space: pre-line;
            word-break: break-word;
        }
        .settings-activity-problem:empty { display: none; }
        .settings-activity-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 2px; min-height: 24px; }
        .settings-activity-actions > [hidden] { display: none; }
        .settings-activity-none { padding: 4px 12px 6px; color: var(--deckit-muted); font: var(--deckit-type-small); }
        .settings-activity-none[hidden] { display: none; }
    `);
    const { element, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const runCard = card('Running', 'No mod is running.');
    const backgroundCard = card('In the background', 'No mod asks to run in the background.');
    const runs = ui.list({ key: (mod) => mod.id, create: runRow, update: (row, mod) => runFills.get(row)(mod) });
    const backgrounds = ui.list({
        key: (mod) => mod.id,
        create: backgroundRow,
        update: (row, mod) => backgroundFills.get(row)(mod),
    });
    runCard.element.insertBefore(runs.element, runCard.none);
    backgroundCard.element.insertBefore(backgrounds.element, backgroundCard.none);
    body.append(runCard.element, backgroundCard.element);
    setInterval(() => element.isConnected && draw(listed), TICK_MS);
    return { element, title: TITLE, glyph: GLYPH, keywords: KEYWORDS, draw };

    // `answered` is what deckit.mods.list(), runs() and interfaces() answered, as `{ list, runs, interfaces }`.
    function draw(answered) {
        listed = answered;
        const running = runningOf(listed.list, listed.runs);
        const asking = listed.list
            .filter((entry) => entry.mod?.background)
            .map((entry) => ({ id: entry.id, name: entry.mod.name, background: entry.mod.background }));
        runs.set(running);
        backgrounds.set(asking);
        runCard.none.hidden = running.length > 0;
        backgroundCard.none.hidden = asking.length > 0;
    }

    function card(title, none) {
        const element = ui.element('div', { className: 'settings-card' });
        const empty = ui.element('div', { className: 'settings-activity-none', text: none });
        element.append(ui.element('div', { className: 'settings-card-title', text: title }), empty);
        return { element, none: empty };
    }

    function runRow(mod) {
        let current = mod;
        const element = ui.element('div', { className: 'settings-activity-row' });
        const words = ui.element('div', { className: 'settings-activity-words' });
        const name = ui.element('div', { className: 'settings-activity-name' });
        const label = ui.element('span');
        // Its actions show while the row is under the pointer or holds the focus, as a list row's do.
        element.dataset.deckitRowActions = '';
        const state = chip({ ui, text: '' });
        const why = ui.element('div', { className: 'settings-activity-why' });
        const problem = ui.element('div', { className: 'settings-activity-problem' });
        const actions = ui.element('div', { className: 'settings-activity-actions' });
        const owns = ui.rowAction({
            icon: ui.icon('link', { size: 14 }),
            title: 'Show the interfaces it owns',
            onClick: onInterfaces,
        });
        const relaunch = ui.rowAction({
            icon: ui.icon('reload', { size: 14 }),
            title: 'Restart this mod',
            onClick: () => ask(current.id, mods.relaunch(current.id)),
        });
        const quit = ui.rowAction({
            icon: ui.icon('power', { size: 14 }),
            title: 'Quit this mod',
            onClick: () => ask(current.id, mods.quit(current.id)),
        });

        name.append(label, state.element);
        words.append(name, why, problem);
        actions.append(owns.element, relaunch.element, quit.element);
        element.append(ui.appIcon(icons.of(mod.id), { size: 'row' }), words, actions);
        ui.selectable(problem);
        runFills.set(element, fill);
        fill(mod);
        return element;

        function fill(mod) {
            current = mod;
            label.textContent = mod.name;
            // Under the Running card, only a run starting or stopping says its state.
            state.element.textContent = STATE_WORDS[mod.run.state];
            state.element.hidden = mod.run.state === 'running';
            const since = mod.run.launchedAt ? elapsedText(Date.now() - mod.run.launchedAt) : '';
            const line = [mod.background ? 'In the background' : '', since].filter(Boolean).join(', ');
            why.textContent = line.charAt(0).toUpperCase() + line.slice(1);
            problem.textContent = problemsOf(mod, refusals.get(mod.id)).join('\n');
            owns.element.hidden = !ownsInterface(mod);
            relaunch.element.hidden = mod.run.state !== 'running';
            quit.element.hidden = mod.run.state === 'terminating';
        }
    }

    function backgroundRow(mod) {
        const element = ui.element('div', { className: 'settings-activity-row' });
        const words = ui.element('div', { className: 'settings-activity-words' });
        const name = ui.element('div', { className: 'settings-activity-name' });
        const reason = ui.element('div', { className: 'settings-activity-why' });

        words.append(name, reason);
        element.append(ui.appIcon(icons.of(mod.id), { size: 'row' }), words);
        backgroundFills.set(element, fill);
        fill(mod);
        return element;

        function fill(mod) {
            name.textContent = mod.name;
            reason.textContent = mod.background;
        }
    }

    // What deckit refused is told on the mod's row, which is drawn again as deckit has it after.
    function ask(id, asked) {
        refusals.delete(id);
        asked
            .catch((error) => refusals.set(id, error.message || String(error)))
            .then(() => Promise.all([mods.list(), mods.runs(), mods.interfaces()]))
            .then(([list, runs, interfaces]) => draw({ list, runs, interfaces }));
    }

    // Whether the mod owns an interface.
    function ownsInterface(mod) {
        return listed.interfaces.some((queue) => queue.owner === mod.id);
    }
}

// The mods of `list` whose latest run, as `runs` answers it, launches, runs or terminates, in the mods' order, each
// `{ id, name, background, run }`.
function runningOf(list, runs) {
    return list.flatMap(({ id, mod }) => {
        const run = runs.find((each) => each.id === id);
        return run && run.state !== 'notRunning'
            ? [{ id, name: mod?.name ?? id, background: mod?.background, run }]
            : [];
    });
}

// How long, in the largest unit that fits: `less than a minute`, `5 min`, `2 h 5 min`, `3 d 2 h`.
function elapsedText(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return 'less than a minute';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ${minutes % 60} min`;
    return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

// What is wrong with a running mod: its run's problem, what its run was refused with at launch, and why deckit
// refused what was last asked of it here.
function problemsOf(mod, refusal) {
    return [mod.run.problem, mod.run.refusal?.message, refusal].filter(Boolean);
}

module.exports = { activitySection, runningOf, elapsedText, problemsOf };
