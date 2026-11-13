import * as LAYER from '../layer/index.js';
import * as PRESENTATION from '../presentation/index.js';

// MARK: - Property
const STYLE = `
    .deckit-modal {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        background: var(--deckit-scrim);
        font: var(--deckit-type-body);
        transition: opacity var(--deckit-fade) var(--deckit-easing);
    }
    .deckit-modal[data-align='top'] { align-items: flex-start; padding-top: 12vh; }
    .deckit-modal[data-align='fill'] { align-items: stretch; background: transparent; }
    .deckit-modal[data-clear] { background: transparent; }
    .deckit-modal-card {
        box-sizing: border-box;
        max-height: 80vh;
        overflow-y: auto;
        padding: 18px 20px 16px;
        border-radius: var(--deckit-radius-card);
        background: var(--deckit-elevated);
        box-shadow: var(--deckit-rim), var(--deckit-shadow-float);
        color: var(--deckit-text);
        transition: transform var(--deckit-move-base) var(--deckit-easing);
    }
    .deckit-modal[data-bare] .deckit-modal-card { padding: 8px; }
    .deckit-modal[data-state='closed'] .deckit-modal-card { transform: translateY(6px) scale(.99); }
    .deckit-modal[data-align='fill'],
    .deckit-modal[data-align='fill'] .deckit-modal-card { transition: none; }
    .deckit-modal[data-align='fill'] .deckit-modal-card {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-height: none;
        border-radius: 0;
        box-shadow: none;
    }
    .deckit-modal[data-drags] .deckit-modal-card { --app-region: drag; }
    .deckit-modal[data-drags] :is(input, textarea, select, button, a) { --app-region: no-drag; }
    .deckit-modal-title { font: 600 var(--deckit-type-heading); margin-bottom: 12px; }
    .deckit-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
`;

// MARK: - Initializer
// MARK: - Public
function make(theme, ui) {
    return { modal: (options) => modal(ui, options) };
}

// MARK: - Private
// A card over the page that holds every press. `fill(card)` puts the content in and returns what takes the
// focus. With `chrome`, a title and Cancel and confirm buttons, a label of null leaving its button out; Enter in a
// text field confirms. `onKey` has a key first and returns whether it took it. `align` is `center`, `top`, or
// `fill`, the card all the page draws, filling it, its edge the page's, which comes and goes at once, as its window
// does. With `drags` the card drags the window it is in where nothing in it is pressed. With `glass` its colour is
// laid at that strength, for a page over what blurs, and its quieter text is in the glass inks. With `clear` the
// page shows through undimmed, the card still holding every press, and it comes and goes at once, as a palette a key
// opens does.
function modal(
    ui,
    {
        title,
        confirmLabel = 'Save',
        cancelLabel = 'Cancel',
        destructive = false,
        extraLabel = null,
        onExtra = null,
        chrome = true,
        align = 'center',
        drags = false,
        clear = false,
        glass = null,
        width = 'min(420px, calc(100vw - 48px))',
        fill,
        onKey: given = () => false,
        onConfirm,
        onClose,
    }
) {
    // Read before the callbacks run, so they see where the keyboard came from, not the button that answered.
    const before = LAYER.activeElement();
    const scrim = document.createElement('div');
    scrim.className = 'deckit-modal';
    scrim.dataset.align = align;
    if (!chrome) scrim.dataset.bare = '';
    if (drags) scrim.dataset.drags = '';
    if (clear) scrim.dataset.clear = '';
    const card = document.createElement('div');
    card.className = 'deckit-modal-card';
    if (align !== 'fill') card.style.width = width;
    if (glass !== null) {
        card.style.background = `color-mix(in srgb, var(--deckit-elevated) ${glass * 100}%, transparent)`;
        card.dataset.deckitGlass = '';
    }
    scrim.append(card);
    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        presented.close();
        if (before?.isConnected) before.focus({ preventScroll: true });
        onClose?.();
    };
    const submit = () => {
        close();
        onConfirm?.();
    };
    const confirms = chrome && confirmLabel !== null;
    // Enter in a text field confirms; one button alone is the default button, which Enter takes from anywhere that is
    // no control of its own.
    const onKey = (event) => {
        if (given(event)) return true;
        if (event.key !== 'Enter') return false;
        if (confirms && event.target.tagName === 'INPUT') submit();
        else if (lone && !event.target.closest?.('button, input, textarea, select, [contenteditable]')) lone.click();
        else return false;
        return true;
    };
    // A mod's own key listeners do not act on what is typed into a modal.
    scrim.addEventListener('keydown', (event) => event.stopPropagation());
    scrim.addEventListener('mousedown', (event) => event.target === scrim && close());

    if (chrome && title) {
        const heading = document.createElement('div');
        heading.className = 'deckit-modal-title';
        heading.textContent = title;
        card.append(heading);
    }
    const focus = fill?.(card) || null;
    const alone = chrome && [cancelLabel !== null, confirms, !!extraLabel].filter(Boolean).length === 1;
    const button = (label, onClick, variant = 'plain') =>
        ui.button({ label, variant: alone && variant === 'plain' ? 'primary' : variant, onClick }).element;
    const cancel = cancelLabel === null ? null : button(cancelLabel, close);
    const confirm = confirms ? button(confirmLabel, submit, destructive ? 'destructive' : 'primary') : null;
    const extra = extraLabel
        ? button(extraLabel, () => {
              close();
              onExtra?.();
          })
        : null;
    if (extra && destructive && !alone) extra.style.color = 'var(--deckit-alert-ink)';
    const lone = alone ? cancel || confirm || extra : null;
    if (chrome) {
        const actions = document.createElement('div');
        actions.className = 'deckit-modal-actions';
        actions.append(...[cancel, extra, confirm].filter(Boolean));
        card.append(actions);
    }
    const presented = PRESENTATION.present({
        element: scrim,
        modal: true,
        speed: align === 'fill' || clear ? null : 'base',
        onKey,
        onDismiss: close,
    });
    (focus || confirm || lone || card).focus();
    focus?.select?.();
    return { close };
}

export { STYLE, make };
