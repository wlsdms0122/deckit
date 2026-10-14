import * as OVERLAY from '../overlay/index.js';
import * as LIST from '../list/index.js';

// MARK: - Property
// A label that took the row's spare width leaves it to the field's margin (`data-grows`); one that did not keeps
// what follows right after it.
const STYLE = `
    .deckit-rename {
        flex: 0 1 auto;
        field-sizing: content;
        min-width: 48px;
        max-width: 100%;
        box-sizing: border-box;
        margin: -2px 0 -2px -4px;
        padding: 1px 4px;
        border: 0;
        outline: none;
        border-radius: var(--deckit-radius-small);
        background: var(--deckit-background);
        box-shadow: 0 0 0 2px var(--deckit-focus);
        color: var(--deckit-text);
    }
    .deckit-rename[data-grows] { margin-right: auto; }
    .deckit-refusal { max-width: 280px; padding: 6px 9px; white-space: normal; color: var(--deckit-alert); }
`;
// A list the field is in (a menu, a drag) must not act on a press or a text drag inside it.
const KEPT_IN = ['pointerdown', 'mousedown', 'click', 'dblclick', 'contextmenu', 'dragstart'];
// How long a refusal shown under the label, after the field is gone, stays.
const REFUSAL_MS = 3000;

// MARK: - Initializer
// MARK: - Public
function make() {
    return { inlineEdit };
}

// MARK: - Private
// Renames `label` in place: a field over it, the name selected (only its stem, before the last dot, with
// `selectStem`). Enter or leaving the field asks `onCommit(text)`, which answers nothing or why it refused; Enter
// keeps the field open on a refusal, leaving it closes it. Escape gives up. Resolves whether it renamed.
function inlineEdit(label, { selectStem = false, onCommit }) {
    const was = label.textContent;
    const row = label.parentElement;
    const look = getComputedStyle(label);
    const input = document.createElement('input');
    input.className = 'deckit-rename';
    input.value = was;
    input.spellcheck = false;
    input.toggleAttribute('data-grows', parseFloat(look.flexGrow) > 0);
    Object.assign(input.style, { font: look.font, letterSpacing: look.letterSpacing });
    for (const type of KEPT_IN) input.addEventListener(type, (event) => event.stopPropagation());
    // Given back only by Enter or Escape: a field left by a click lets the click decide where the focus goes.
    const before = document.activeElement;
    const giveBack = () => {
        const to = before && before !== document.body && before.isConnected ? before : row?.closest('[tabindex]');
        to?.focus({ preventScroll: true });
    };
    const display = label.style.display;
    label.style.display = 'none';
    label.after(input);
    // Held, so the list waits to change instead of taking the field away mid-word.
    const release = LIST.hold(input);
    input.focus();
    const dot = was.lastIndexOf('.');
    input.setSelectionRange(0, selectStem && dot > 0 ? dot : was.length);
    input.scrollIntoView({ block: 'nearest' });

    let refusal = null;
    const clear = () => {
        refusal?.remove();
        refusal = null;
    };
    const refuse = (why, under, length = 0) => {
        clear();
        refusal = document.createElement('div');
        refusal.className = 'deckit-menu deckit-refusal';
        refusal.style.zIndex = String(OVERLAY.Z.float);
        refusal.textContent = why;
        document.body.append(refusal);
        OVERLAY.place(refusal, { anchor: under, gap: 6 });
        if (!length) return;
        const shown = refusal;
        setTimeout(() => refusal === shown && clear(), length);
    };

    return new Promise((resolve) => {
        let over = false;
        let asking = false;
        const end = (renamed, text) => {
            if (over) return;
            over = true;
            clear();
            if (renamed) label.textContent = text;
            const focused = document.activeElement === input;
            input.remove();
            label.style.display = display;
            if (focused) giveBack();
            release();
            resolve(renamed);
        };
        const commit = async (stay) => {
            if (over || asking) return;
            const text = input.value.trim();
            if (!text || text === was) return end(false);
            asking = true;
            input.readOnly = true;
            let why;
            try {
                why = await onCommit(text);
            } catch (error) {
                why = String(error?.message || error);
            }
            asking = false;
            input.readOnly = false;
            if (!why) return end(true, text);
            if (stay && document.activeElement === input) {
                refuse(why, input);
                input.select();
                return;
            }
            end(false);
            refuse(why, label, REFUSAL_MS);
        };
        input.addEventListener('input', clear);
        input.addEventListener('keydown', (event) => {
            event.stopPropagation();
            // A key an input method takes reports 229 before its composition starts.
            if (event.isComposing || event.keyCode === 229) return;
            if (event.key === 'Enter') {
                event.preventDefault();
                commit(true);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                if (!asking) end(false);
            }
        });
        input.addEventListener('blur', () => !asking && commit(false));
    });
}

export { STYLE, make };
