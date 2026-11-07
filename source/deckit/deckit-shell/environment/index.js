export { MAIN, PAGE, WEB_DECK, missingIn, checked } from '../deckit/environment/index.js';

// MARK: - Property
/**
 * A page as a stage lays it, bottom to top: at `rect`, taking the pointer only inside the rects of `input`, from its
 * top left, where it has them, or hidden in the place it has.
 * @typedef {{ page: Page, rect: Rect, input?: Rect[] } | { page: Page, hidden: true }} Laid
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 */

// What an environment gives a UI shell on deckit, on main's side: the pages it draws in, which run no mod, a stage to
// lay pages on, and the fonts installed. `load`, `close` and `watch` are as `MAIN.pages` says.
const SHELL = Object.freeze({
    pages: {
        // make({ name, keepsDrawing }) -> page, made and not loaded: a page that runs no mod, `name` a lower case
        // letter then letters, digits and `-`, at an origin of its own that is never a mod's, laid out while hidden
        // too when `keepsDrawing`. It opens no window of its own
        make: 'function',
        load: 'function',
        close: 'function',
        focus: 'function', // focus(page): the page takes the keyboard
        // droppedFiles(page) -> the paths of the files last dropped on the page from outside the app, as dropped
        droppedFiles: 'function',
        isClosed: 'function', // isClosed(page): whether the page is gone for good, closed or destroyed
        watch: 'function',
        // surfaces(page, { allow(name) -> boolean, opened(name, surface) }): the documents a page of deckit's, a mod's
        // or one that runs none, may open with `window.open('', name)`, those `allow` answers true for, each a page of
        // its own (`surface`), laid as any page is, which runs no code and goes nowhere. What else it asks for is no
        // window, told to what watches its `opens`
        surfaces: 'function',
    },
    // stage() -> a stage (`STAGE`): where pages are laid in one of the host app's windows
    stage: 'function',
    // fonts() -> { families, monospaced }: the font families installed, by name, and those of them whose faces are
    // fixed-width, as read at each call
    fonts: 'function',
});

// What SHELL.stage() makes. `place(window, { bounds, front, onClose })`: the stage in one of the host app's windows at
// a time, `bounds` a rect or a function of the window's content size that it follows, `front` over what is in the
// window already, `onClose()` once it is out of a closing window; `size() -> { width, height }`;
// `whenResized(listener) -> off`; `show(on)`; `lay(laid)`, the pages on it, Laid, bottom to top: a hidden one is kept
// out of the window, and a page left out, or gone, is taken off; `close()`, the stage ended, its pages taken off and it
// out of its window. Where a page laid on it, or a surface it opened, marks itself with `--app-region: drag`, a press
// drags the window it is in and a double click does what the person set a title bar's to do; `--app-region: no-drag`
// marks what inside it takes presses itself.
const STAGE = Object.freeze({
    place: 'function',
    size: 'function',
    whenResized: 'function',
    show: 'function',
    lay: 'function',
    close: 'function',
});

export { SHELL, STAGE };
