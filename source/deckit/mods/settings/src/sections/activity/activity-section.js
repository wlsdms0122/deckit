const { chip } = require('../../chip/chip.js');
const { section } = require('../section/section.js');

// The words of a run's state, as the Activity section shows it.
const STATE_WORDS = { launching: 'Starting', running: 'Running', terminating: 'Stopping' };
// How often the time a mod has run for is drawn again while the section is in the page.
const TICK_MS = 30000;

// The Activity section: every mod running now, with a view or without, its run's state, why it runs, how long it has
// run and what is wrong with it, with a quit and a restart; and the startup list, each mod that asks to start with the
// app with its reason and a switch approving it. `mods` is deckit.mods; `onInterfaces()` shows the Interfaces section.
function activitySection({ ui, mods, onInterfaces }) {
    const TITLE = 'Activity';
    const KEYWORDS = ['활동', '실행', '시작', 'activity', 'running', 'quit', 'startup', 'login'];
    const DESCRIPTION =
        'The mods running now, with a view or without, why each runs and for how long. Quit one, or restart it. ' +
        'Below, the mods that ask to start with the app: switch one off and it starts only when something opens it.';

    const runFills = new WeakMap(); // run row -> its fill(mod)
    const startupFills = new WeakMap(); // startup row -> its fill(mod)
    const refusals = new Map(); // mod id -> why deckit refused what was last asked of it here
    let found = []; // what deck last listed

    ui.addStyle(`
        .settings-activity-row { display: flex; align-items: flex-start; gap: 10px; padding: 6px 12px; }
        .settings-activity-words { display: flex; flex: 1 1 auto; flex-direction: column; gap: 1px; min-width: 0; }
        .settings-activity-name { display: flex; align-items: center; gap: 6px; font: var(--deckit-type-body); }
        .settings-activity-why { font: var(--deckit-type-small); line-height: 1.45; opacity: 0.5; }
        .settings-activity-problem {
            color: var(--deckit-alert);
            font: var(--deckit-type-small);
            line-height: 1.45;
            white-space: pre-line;
            word-break: break-word;
        }
        .settings-activity-problem:empty { display: none; }
        .settings-activity-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 2px; min-height: 22px; }
        .settings-activity-actions > [hidden] { display: none; }
        .settings-activity-none { padding: 4px 12px 6px; font: 12.5px var(--deckit-font); opacity: 0.4; }
        .settings-activity-none[hidden] { display: none; }
    `);
    const { element, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const runCard = card('Running', 'No mod is running.');
    const startupCard = card('Starting with the app', 'No mod asks to start with the app.');
    const runs = ui.list({ key: (mod) => mod.id, create: runRow, update: (row, mod) => runFills.get(row)(mod) });
    const startups = ui.list({
        key: (mod) => mod.id,
        create: startupRow,
        update: (row, mod) => startupFills.get(row)(mod),
    });
    runCard.element.insertBefore(runs.element, runCard.none);
    startupCard.element.insertBefore(startups.element, startupCard.none);
    body.append(runCard.element, startupCard.element);
    setInterval(() => element.isConnected && draw(found), TICK_MS);
    return { element, title: TITLE, keywords: KEYWORDS, draw };

    // `listed` is what deckit.mods.list() answered as `found`.
    function draw(listed) {
        found = listed;
        const running = runningOf(found);
        const asking = found.filter((mod) => mod.startup && !mod.problem);
        runs.set(running);
        startups.set(asking);
        runCard.none.hidden = running.length > 0;
        startupCard.none.hidden = asking.length > 0;
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
            title: 'Restart this mod, and the mods that require it',
            onClick: () => ask(current.id, mods.relaunch(current.id)),
        });
        const quit = ui.rowAction({
            icon: ui.icon('power', { size: 14 }),
            title: 'Quit this mod, and the mods that require it',
            onClick: () => ask(current.id, mods.quit(current.id)),
        });

        name.append(label, state.element);
        words.append(name, why, problem);
        actions.append(owns.element, relaunch.element, quit.element);
        element.append(words, actions);
        ui.selectable(problem);
        runFills.set(element, fill);
        fill(mod);
        return element;

        function fill(mod) {
            current = mod;
            label.textContent = mod.name;
            state.element.textContent = STATE_WORDS[mod.run.state];
            const since = mod.run.launchedAt ? elapsedText(Date.now() - mod.run.launchedAt) : '';
            why.textContent = [originText(mod.run.origin, nameIn(found)), since].filter(Boolean).join(' · ');
            problem.textContent = problemsOf(mod, refusals.get(mod.id)).join('\n');
            owns.element.hidden = !ownsInterface(mod);
            relaunch.element.hidden = mod.run.state !== 'running';
            quit.element.hidden = mod.run.state === 'terminating';
        }
    }

    function startupRow(mod) {
        let current = mod;
        const element = ui.element('div', { className: 'settings-activity-row' });
        const words = ui.element('div', { className: 'settings-activity-words' });
        const name = ui.element('div', { className: 'settings-activity-name' });
        const reason = ui.element('div', { className: 'settings-activity-why' });
        const problem = ui.element('div', { className: 'settings-activity-problem' });
        const toggle = ui.toggle({
            onChange: (on) => {
                toggle.set(on);
                approve(current.id, on);
            },
        });

        words.append(name, reason, problem);
        element.append(words, toggle.element);
        startupFills.set(element, fill);
        fill(mod);
        return element;

        function fill(mod) {
            current = mod;
            name.textContent = mod.name;
            reason.textContent = mod.startup;
            problem.textContent = refusals.get(mod.id) || '';
            toggle.set(mod.startupApproved);
        }
    }

    // What deckit refused is told on the mod's row, which is drawn again as deck has it after.
    function approve(id, approved) {
        ask(id, mods.approveStartup(id, approved));
    }

    function ask(id, asked) {
        refusals.delete(id);
        asked.then(
            () => draw(mods.list().found),
            (error) => {
                refusals.set(id, error.message || String(error));
                draw(mods.list().found);
            }
        );
    }

    // Whether the mod owns an interface.
    function ownsInterface(mod) {
        return mods.list().interfaces.some((queue) => queue.owner === mod.id);
    }
}

// The mods whose latest run launches, runs or terminates, in the mods' order.
function runningOf(found) {
    return found.filter((mod) => mod.run && mod.run.state !== 'notRunning');
}

// A mod's name by its id, among `found`, or the id for one not found.
function nameIn(found) {
    return (id) => found.find((mod) => mod.id === id)?.name || id;
}

// Why a run launched (deckit.mods.list(), `run.origin`), in words; `nameOf(id)` names a mod.
function originText(origin, nameOf) {
    switch (origin?.kind) {
        case 'person':
            return 'Opened by you';
        case 'startup':
            return 'Started with the app';
        case 'required':
            return `Required by ${nameOf(origin.by)}`;
        case 'work': {
            const by = origin.mod ? ` from ${nameOf(origin.mod)}` : '';
            return workText(origin.work) + by;
        }
        default:
            return '';
    }
}

// The work a mod launched for, as the layer that asked for it describes it.
function workText(work) {
    if (work?.connection) return `For a connection to ${work.connection}`;
    if (work?.command) return `For its command ${work.command}`;
    if (work?.token) return 'For a command it handed out';
    if (work?.key) return `For its key ${work.key}`;
    if (work?.url) return `To open ${work.url}`;
    return 'For work asked of it';
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

// What is wrong with a running mod: its run's problem, what it declares wrong, and why deckit refused what was last
// asked of it here.
function problemsOf(mod, refusal) {
    return [mod.run.problem, ...(mod.declarationProblems || []), refusal].filter(Boolean);
}

module.exports = { activitySection, runningOf, originText, elapsedText, problemsOf };
