const { game } = require('../game/game.js');

// What is said of a load that failed, by its kind (the web engine's `state.failure`): what happened, then what to do.
const WORDS = {
    'no-connection': ['You are not connected', 'Check the network connection, then try again.'],
    'host-not-found': [
        'This site could not be found',
        'No server answers to this name. Check how the address is spelled.',
    ],
    refused: ['The site refused to connect', 'It may be down, or not running at this address.'],
    'timed-out': ['The site took too long to answer', 'It may be busy, or the network slow. Try again in a moment.'],
    other: ['This page could not be loaded', 'Something went wrong on the way to it.'],
};

// What a tab whose page failed to load shows in the area of pages in its place (tab-list.js): what went wrong and the
// address, Try Again (`onRetry()`), which loads it again, and under them a game to pass the time with. The game runs
// only while the page is shown and its window is the key one (`setKey`).
function loadFailure({ ui, theme, values, onRetry }) {
    ui.addStyle(`
        .browser-failure {
            position: absolute;
            inset: 0;
            overflow-y: auto;
            display: none;
            background: var(--deckit-background);
        }
        .browser-failure[data-shown] { display: block; }
        .browser-failure-body {
            box-sizing: border-box;
            max-width: 600px;
            margin: 0 auto;
            padding: 72px 24px 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
        }
        .browser-failure-title {
            margin: 0;
            color: var(--deckit-text);
            font: 600 var(--deckit-type-title);
            letter-spacing: var(--deckit-tracking-title);
        }
        .browser-failure-hint { margin: 8px 0 0; color: var(--deckit-muted); font: var(--deckit-type-body); }
        .browser-failure-address {
            margin: 4px 0 0;
            max-width: 100%;
            color: var(--deckit-muted);
            font: var(--deckit-type-small);
            overflow-wrap: anywhere;
        }
        .browser-failure-actions { margin-top: 20px; }
        .browser-failure-game { align-self: stretch; margin-top: 32px; }
    `);
    const element = ui.element('div', { className: 'browser-failure' });
    const body = ui.element('div', { className: 'browser-failure-body' });
    const title = ui.element('h1', { className: 'browser-failure-title' });
    const hint = ui.element('p', { className: 'browser-failure-hint' });
    const address = ui.element('p', { className: 'browser-failure-address' });
    ui.selectable(address);
    const actions = ui.element('div', { className: 'browser-failure-actions' });
    const retry = ui.button({ label: 'Try Again', variant: 'primary', size: 'medium', onClick: () => onRetry() });
    actions.append(retry.element);
    const play = game({ ui, theme, values });
    play.element.classList.add('browser-failure-game');
    body.append(title, hint, address, actions, play.element);
    element.append(body);
    let shown = false;
    let key = false;

    return { element, show, setKey, release: () => play.release() };

    // The failure of the tab in front, `{ url, kind }`, while it is `loading` again, or null where it has none. Shown
    // where the tab's page had the keyboard, the game takes it.
    function show(failure, { loading = false } = {}) {
        const was = shown;
        shown = !!failure;
        element.toggleAttribute('data-shown', shown);
        if (shown) {
            const [said, next] = WORDS[failure.kind] || WORDS.other;
            title.textContent = said;
            hint.textContent = next;
            address.textContent = failure.url;
            retry.setEnabled(!loading);
            const held = document.activeElement;
            if (!was && (!held || held === document.body || element.parentElement?.contains(held))) play.focus();
        }
        play.setActive(shown && key);
    }

    function setKey(on) {
        key = on;
        play.setActive(shown && key);
    }
}

module.exports = { loadFailure };
