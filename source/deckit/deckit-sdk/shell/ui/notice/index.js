import * as ICON from '../icon/index.js';

// MARK: - Property
const STYLE = `
    .deckit-notice {
        display: flex;
        gap: 8px;
        box-sizing: border-box;
        padding: 12px;
        border-radius: var(--deckit-radius-medium);
        background: color-mix(in srgb, var(--deckit-alert) 10%, var(--deckit-background));
        color: var(--deckit-text);
        font: var(--deckit-type-body);
    }
    .deckit-notice[data-kind='warning'] {
        background: color-mix(in srgb, var(--deckit-warn) 10%, var(--deckit-background));
    }
    .deckit-notice-glyph { display: flex; flex: 0 0 auto; padding-top: 1px; color: var(--deckit-alert-ink); }
    .deckit-notice[data-kind='warning'] .deckit-notice-glyph { color: var(--deckit-warn-ink); }
    .deckit-notice-body {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        min-width: 0;
    }
    .deckit-notice-text { overflow-wrap: anywhere; }
    .deckit-notice-more {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--deckit-muted);
        font: var(--deckit-type-small);
        cursor: pointer;
    }
    .deckit-notice-more svg { transition: transform var(--deckit-move) var(--deckit-move-curve); }
    .deckit-notice-more[data-still] svg { transition: none; }
    .deckit-notice-more[aria-expanded='true'] svg { transform: rotate(90deg); }
    .deckit-notice-details {
        margin: 0;
        color: var(--deckit-muted);
        font: var(--deckit-type-small);
        font-family: var(--deckit-mono);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
    .deckit-notice-details[hidden] { display: none; }
`;
const KINDS = Object.freeze(['failure', 'warning']);

// MARK: - Initializer
// MARK: - Public
function make(theme, ui) {
    return { notice: (options) => notice(ui, options) };
}

// MARK: - Private
// What went wrong, or what to look out for, where the result would be: a tinted well with the `info` glyph, `text`,
// the raw `details` behind a disclosure, and an `action` `{ label, run }` under the text. `kind` is `failure`, read
// out as an alert, or `warning`. `set(options)` draws it anew.
function notice(ui, options) {
    const element = document.createElement('div');
    element.className = 'deckit-notice';
    const glyph = tag('span', 'deckit-notice-glyph');
    glyph.innerHTML = ICON.icon('info', { size: 16 });
    const body = tag('div', 'deckit-notice-body');
    element.append(glyph, body);
    const set = ({ kind = 'failure', text = '', details = '', action = null }) => {
        element.dataset.kind = KINDS.includes(kind) ? kind : 'failure';
        if (kind === 'warning') element.removeAttribute('role');
        else element.setAttribute('role', 'alert');
        const words = tag('div', 'deckit-notice-text');
        words.textContent = text;
        body.replaceChildren(words);
        if (details) body.append(...disclosure(details));
        if (action) body.append(ui.button({ label: action.label, size: 'small', onClick: action.run }).element);
    };
    set(options);
    return { element, set };
}

// The Details button and the words it shows and hides. A key opens it at once; a press turns its chevron.
function disclosure(details) {
    const more = tag('button', 'deckit-notice-more');
    more.type = 'button';
    more.setAttribute('aria-expanded', 'false');
    more.innerHTML = ICON.icon('chevronRight', { size: 13 });
    more.append('Details');
    const words = tag('pre', 'deckit-notice-details');
    words.textContent = details;
    words.hidden = true;
    more.addEventListener('click', (event) => {
        more.toggleAttribute('data-still', event.detail === 0);
        words.hidden = !words.hidden;
        more.setAttribute('aria-expanded', String(!words.hidden));
    });
    return [more, words];
}

function tag(name, className) {
    const made = document.createElement(name);
    made.className = className;
    return made;
}

export { STYLE, make };
