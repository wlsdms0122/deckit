import * as SCROLL from '../scroll/index.js';

// MARK: - Property
// A title bar's height, in px, the window's title bar's: its contents centre on the window's buttons over it.
const TITLE_BAR = 48;
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
    ::selection { background: color-mix(in srgb, var(--deckit-accent) 24%, transparent); }
    :root {
        caret-color: var(--deckit-accent);
        scrollbar-color: color-mix(in srgb, var(--deckit-muted) 60%, transparent) transparent;
        overscroll-behavior: none;
    }
    .deckit-pressable { transition: background-color var(--deckit-fade) var(--deckit-easing); }
    .deckit-pressable:hover { background: var(--deckit-hover); }
    .deckit-pressable:active { background: var(--deckit-pressed); }
    .deckit-pressable:is(:disabled, [aria-disabled='true']) { background: transparent; }
    .deckit-title-bar {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 0 0 auto;
        box-sizing: border-box;
        min-height: ${TITLE_BAR}px;
        padding: 0 calc(12px + var(--deckit-safe-area-inset-right, 0px)) 0 calc(12px + var(--deckit-safe-area-inset-left, 0px));
        margin-left: var(--deckit-title-bar-area-x, 0px);
    }
    .deckit-title-bar[data-hairline] { border-bottom: 1px solid var(--deckit-divider); }
    [data-deckit-title-bar] .deckit-title-bar {
        --app-region: drag;
        min-height: max(${TITLE_BAR}px, var(--deckit-title-bar-area-height));
    }
    .deckit-title-bar-title {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: 600 var(--deckit-type-heading);
    }
    [data-deckit-key='false'] :is(
        .deckit-title-bar,
        .deckit-title-bar .deckit-button:not([data-variant], :disabled, [aria-disabled='true']),
        .deckit-title-bar .deckit-crumb[aria-current='page']
    ) {
        color: var(--deckit-muted);
    }
    [data-deckit-key='false'] :is(
        .deckit-row[data-active],
        [data-deckit-tree]:focus-within .deckit-row[data-active],
        .deckit-section-heading[data-current]
    ) {
        background: var(--deckit-fill);
    }
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

// A bar along the top of the view, the one thing laid in the window's title bar area where the bar lies over it: as
// tall as the bar and TITLE_BAR at least, what it holds in a row centred on the window's buttons, from the area's
// start, inside the safe area's sides, and dragging the window wherever nothing in it is pressed. A
// control the kit does not know as one marks itself `--app-region: no-drag`. `title` puts the view's title first;
// `scroller` is what scrolls under the bar, whose edges fade where there is more of it; `hairline` draws a rule under
// the bar instead, for content the fade cannot reach, as a web page. While the page's root is
// marked `data-deckit-key="false"`, its window not the key one, the bar's text and glyphs are muted, its title a
// breadcrumb's current part too; what is disabled stays as it is.
function titleBar(element, { title = null, scroller = null, hairline = false } = {}) {
    element.classList.add('deckit-title-bar');
    element.toggleAttribute('data-hairline', hairline);
    const heading = title == null ? null : element.ownerDocument.createElement('div');
    if (heading) {
        heading.className = 'deckit-title-bar-title';
        heading.textContent = title;
        element.prepend(heading);
    }
    const unfade = scroller ? SCROLL.edgeFade(scroller) : () => {};
    return () => {
        element.classList.remove('deckit-title-bar');
        element.removeAttribute('data-hairline');
        heading?.remove();
        unfade();
    };
}

// MARK: - Private
export { STYLE, element, pressable, selectable, titleBar };
