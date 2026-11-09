// MARK: - Property
/**
 * A page as a stage lays it, bottom to top: at `rect`, drawn only inside `clip`, a rect on the stage with its corners
 * rounded by `cornerRadius`, where it has one, taking the pointer only inside the rects of `input`, from its top left,
 * where it has them, or hidden in the place it has.
 * @typedef {{ page: Page, rect: Rect, clip?: Clip, input?: Rect[] } | { page: Page, hidden: true }} Laid
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 * @typedef {{ x: number, y: number, width: number, height: number, cornerRadius?: number }} Clip
 */

// What an environment gives a UI shell on deckit, on main's side: the pages it draws in, which run no mod, the keys
// pressed in the app's pages and in every app, a stage to lay pages on, the fonts installed, and what the person set a
// double click on a title bar to do. `load`, `close` and `watch` are as `MAIN.pages` says.
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
    keys: {
        // capture(page, handler(pressed) -> boolean): each key pressed in the page, `{ type, code, meta, control, alt,
        // shift }` with `type` as UI Events names it (`keydown`, `keyup`), told before the page has it and taken from
        // the page when `handler` answers true, at once. Told after what `pages.watchInput` (MAIN, WEB) told of it,
        // when that watch began first
        capture: 'function',
        // unhandled(page, handler(keystroke) -> boolean): each key down pressed in the page that the page did not
        // handle, by cancelling it or acting on it, `{ code, meta, control, alt, shift }`, told after the page had it
        // and taken from the rest of the app when `handler` answers true. One a web page shown in an element did not
        // handle is the element's page's next: a key down at its element, then told as that page's when not cancelled
        unhandled: 'function',
        // hotkey(keystroke, handler()) -> off, or null when the system does not give it: a key, `{ code, meta,
        // control, alt, shift }`, heard wherever the keyboard is, in any app, once the app is ready, `handler()` told
        // each time it is pressed and the key taken from wherever it was pressed
        hotkey: 'function',
    },
    // stage() -> a stage (`STAGE`): where pages are laid in one of the host app's windows
    stage: 'function',
    // fonts() -> { families, monospaced }: the font families installed, by name, and those of them whose faces are
    // fixed-width, as read at each call
    fonts: 'function',
    // actionOnDoubleClick() -> 'zoom', 'minimize' or 'none', as read at each call
    actionOnDoubleClick: 'function',
});

// What SHELL.stage() makes. `place(window, { bounds, front, onClose })`: the stage in one of the host app's windows at
// a time, `bounds` a rect or a function of the window's content size that it follows, `front` over what is in the
// window already, `onClose()` once it is out of a closing window; `size() -> { width, height }`;
// `whenResized(listener) -> off`; `show(on)`; `lay(laid)`, the pages on it, Laid, bottom to top: a hidden one is kept
// out of the window, and a page left out, or gone, is taken off; `close()`, the stage ended, its pages taken off and it
// out of its window. Where a page laid on it, or a surface it opened, marks itself with `--app-region: drag`, a press
// drags the window it is in and a double click does what the person set a title bar's to do, unless what draws in that
// document took its drags (PAGE.drags); `--app-region: no-drag` marks what inside it takes presses itself.
const STAGE = Object.freeze({
    place: 'function',
    size: 'function',
    whenResized: 'function',
    show: 'function',
    lay: 'function',
    close: 'function',
});

export { SHELL, STAGE };
