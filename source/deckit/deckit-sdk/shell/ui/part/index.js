// MARK: - Property
// The focus ring every part draws, at no weight, so a part or a view that draws its own keeps it: outside the edge, or
// inside it for what is typed into.
const STYLE = `
    :where(
        :focus-visible,
        .deckit-field:has(:focus-visible),
        .deckit-stepper:has(.deckit-stepper-input:focus-visible)
    ) {
        outline: 2px solid var(--deckit-focus);
        outline-offset: 2px;
    }
    :where(input, textarea, .deckit-field, .deckit-stepper) { outline-offset: -2px; }
    ::placeholder { color: var(--deckit-placeholder); opacity: 1; }
    .deckit-pressable { transition: background-color var(--deckit-fade) var(--deckit-easing); }
    .deckit-pressable:hover { background: var(--deckit-hover); }
    .deckit-pressable:active { background: var(--deckit-pressed); }
    .deckit-pressable:disabled { background: transparent; }
    .deckit-title-bar {
        box-sizing: border-box;
        min-height: var(--deckit-title-bar-area-height, 0px);
        margin-left: var(--deckit-title-bar-area-x, 0px);
        transition: margin-left var(--deckit-move-base) var(--deckit-easing-move);
    }
    [data-deckit-title-bar] .deckit-title-bar { --app-region: drag; }
    .deckit-title-bar :is(button, input, textarea, select, a[href], [role='button'], [tabindex], [contenteditable]) {
        --app-region: no-drag;
    }
`;

// MARK: - Initializer
// MARK: - Public
// An element: `className`, inline `style` and `text`.
function element(tag, { className = '', style = {}, text = null } = {}) {
    const made = document.createElement(tag);
    if (className) made.className = className;
    Object.assign(made.style, style);
    if (text != null) made.textContent = text;
    return made;
}

// Something pressed, washed under the pointer and ringed when the keyboard reaches it.
function pressable(element) {
    element.classList.add('deckit-pressable');
    return () => element.classList.remove('deckit-pressable');
}

// Text the person can select, in a page where nothing is by default. WebKit takes only the prefixed property.
function selectable(element) {
    element.style.webkitUserSelect = element.style.userSelect = 'text';
    return () => (element.style.webkitUserSelect = element.style.userSelect = '');
}

// A bar along the top of the view, where the window's title bar may lie over it: at least as tall as the
// bar, clear of the window's buttons, and dragging the window wherever nothing in it is pressed. A control the
// kit does not know as one marks itself `--app-region: no-drag`.
function titleBar(element) {
    element.classList.add('deckit-title-bar');
    return () => element.classList.remove('deckit-title-bar');
}

// MARK: - Private
export { STYLE, element, pressable, selectable, titleBar };
