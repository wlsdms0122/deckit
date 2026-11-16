// MARK: - Property
/**
 * A page as a stage lays it, bottom to top: at `rect`, drawn only inside `clip`, a rect on the stage with its corners
 * rounded by `cornerRadius`, where it has one, taking the pointer only inside the rects of `input`, from its top left,
 * where it has them, or hidden in the place it has; or a material of the host's (`menu`, `popover`, `sidebar`, `hud`),
 * blurring what the window shows under `rect`, the layers before it included, its corners rounded by `cornerRadius`,
 * and taking no clicks.
 * @typedef {{ page: Page, rect: Rect, clip?: Clip, input?: Rect[] } | { page: Page, hidden: true }
 *     | { material: string, rect: Rect, cornerRadius?: number }} Laid
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 * @typedef {{ x: number, y: number, width: number, height: number, cornerRadius?: number }} Clip
 */

// What an environment gives a UI shell on deckit, on main's side: the pages it draws in, which run no mod, the keys
// pressed in the app's pages and in every app and which of the app's pages has the keyboard, a stage to lay pages on,
// the fonts installed, what the person set a double click on a title bar to do, the folders the person chooses in a
// dialog, and a path shown where it lies. `load`, `close` and `watch` are as `MAIN.pages` says.
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
        // shift, source }` with `type` as UI Events names it (`keydown`, `keyup`), `source` the one it was put with
        // (`input.put`) or the machine's (`input.machine`), told before the page has it and taken from
        // the page when `handler` answers true, at once. Told after what `WEB.pages.watchInput` told of it, when that
        // watch began first
        capture: 'function',
        // unhandled(page, handler(keystroke) -> boolean): each key down pressed in the page that the page did not
        // handle, by cancelling it or acting on it, `{ code, meta, control, alt, shift, source }`, told after the page
        // had it and taken from the rest of the app when `handler` answers true. One a web page shown in an element
        // did not handle is the element's page's next: a key down at its element, then told as that page's when not
        // cancelled
        unhandled: 'function',
        // hotkey(keystroke, handler()) -> off, or null when the system does not give it: a key, `{ code, meta,
        // control, alt, shift }`, heard wherever the keyboard is, in any app, once the app is ready, `handler()` told
        // each time it is pressed and the key taken from wherever it was pressed
        hotkey: 'function',
        // focused() -> Page or null: the page of the app's that has the keyboard, or null when the app does not
        focused: 'function',
        // reserve(page, on): while on, a press of the machine's pointer reaches the page and leaves the keyboard
        // where it is; a page has the keyboard only as it is pressed or given it (`pages.focus`), never as its
        // document focuses an element
        reserve: 'function',
    },
    input: {
        // listen(handler(event)) -> off: each event of the machine's pointer and keyboard as the app has it,
        // `{ event: 'pointer', type, x, y, button, buttons, modifiers, count, dx, dy }`, `type` `move`, `down`, `up` or
        // `scroll`, `button` 0 to 2 as UI Events numbers them, `buttons` those held and `modifiers` of `alt`,
        // `control`, `meta`, `shift`, both arrays, or `{ event: 'key', type, code, key, modifiers, repeat }`, `type`
        // `down` or `up`; with `page`, the page it is delivered to, its point from that page's top left, or null and
        // the point from the window's content's, and `carried: true`, the page having it already. Moves are told once
        // a frame
        listen: 'function',
        // put(page, event): such an event, or `{ event: 'text', type, text }`, `type` `insert`, `compose`, `commit`
        // or `cancel`, with `source`, an opaque word for the devices it came from, put into `page` at a point from
        // its top left. The page is not given the keyboard and no window's order changes; a key it tells
        // (`keys.capture`, `keys.unhandled`) carries that `source`, and one it does not handle reaches nothing else
        put: 'function',
        // machine(source): the source of the machine's own pointer and keyboard from now on, which a key of theirs a
        // page tells carries
        machine: 'function',
    },
    // How a page reads to one who cannot see it, from what its document drew, its elements' roles, names and states.
    // A document has a number, another for each document a page shows, and an element a ref, `<document>.<n>`, the
    // same while the element is in its document. What is asked of an element or a document that is gone is refused
    // with an error whose `code` is `GONE`
    read: {
        // outline(page, knobs) -> Promise of `{ document, count, width, height, lines }`: the page's size and its
        // lines top to bottom, each `{ depth, role, name, length, states, items, inView, below, ref }`, `name` cut to
        // `text` characters and `length` its whole length where it was cut, `states` words, `items` the items it holds
        // and `inView` those in view, `below` the elements under a line at the deepest level; `count` is the
        // document's count of changes the answer is at. `knobs`: `depth` (30), `roles` (all), only lines of these
        // roles and those that hold them, `all` (false), the whole document and not what is in view, `items` (30),
        // those of one container listed, `text` (80)
        outline: 'function',
        // node(page, ref, knobs) -> Promise of `{ document, count, line, rect, scroll, lines, more, selection,
        // caret, selected }`: the element's own line, its rect in the page, `{ top, height, left, width }` where it
        // scrolls, the lines under it, its text too as lines of role `text`, `more` those left out, what is selected
        // in a field, `{ start, end }` in its value or `{ line, column, length }` in editable content, and, while it
        // has its document's focus, the rect its caret is at and `selected`, the rects what is selected in it is
        // drawn at, one a line of text. `knobs` as of `outline`, `text` 200, and `lines`, the text lines
        // listed, those in view without
        node: 'function',
        // changes(page, { document, count }) -> Promise of `{ document, from, count, entries }`: what reads otherwise
        // in the document since that count, each `{ kind: '~', ...line }`, a line as it reads now, `not in view`
        // among its states where it is out of sight, `{ kind: '+', ...line }`, a line not answered before that came
        // into sight since, it or an element above it added or changing an attribute, or `{ kind: '-', ref }`, an
        // element gone. A count however old is answered; one the document never had is refused with an error whose
        // `code` is `STALE`
        changes: 'function',
        // place(page, ref) -> Promise of `{ x, y, width, height }`: the element's rect in the page, once it is
        // scrolled into view
        place: 'function',
        // listen(handler({ page, document, count })) -> off: each count of a document, which goes up as what it shows
        // changes, at most once a frame
        listen: 'function',
    },
    // stage() -> a stage (`STAGE`): where pages are laid in one of the host app's windows
    stage: 'function',
    // fonts() -> { families, monospaced }: the font families installed, by name, and those of them whose faces are
    // fixed-width, as read at each call
    fonts: 'function',
    // actionOnDoubleClick() -> 'zoom', 'minimize' or 'none', as read at each call
    actionOnDoubleClick: 'function',
    // chooseFolders({ title, buttonLabel, message, multiple }) -> Promise of the folders the person chose, one unless
    // `multiple`, none when they chose none
    dialogs: { chooseFolders: 'function' },
    // reveal(path): an absolute path shown where it lies, nothing shown when there is none there
    reveal: 'function',
});

// What an environment gives a UI shell on deckit on a page's side: the presses in drag regions. Where a document marks
// itself `--app-region: drag`, a press moves the window it is shown in and a double click does what the person set a
// title bar's to do, `no-drag` marking what inside takes presses itself. take(document, pressed(event)) -> off: those
// in `document`, this page's or a surface it opened, each handed to `pressed` as its `mousedown` event instead, the
// moves and the release that follow the document's
const SHELL_PAGE = Object.freeze({
    drags: { take: 'function' },
});

// What SHELL.stage() makes. `place(window, { bounds, front, onClose })`: the stage in one of the host app's windows at
// a time, `bounds` a rect or a function of the window's content size that it follows, `front` over what is in the
// window already, `onClose()` once it is out of a closing window; `size() -> { width, height }`; `whenResized(listener)
// -> off`; `show(on)`; `lay(laid)`, the pages on it, Laid, bottom to top: a hidden one is kept out of the window, and a
// page left out, or gone, is taken off; `hit(laid, point) -> { page, x, y } or null`, the page a press at a point of
// the stage reaches were `laid` what is on it, with the point from that page's top left, read from the list alone, so
// for an order that is not shown too; `capture(laid, { rect, scale }) -> Promise of a PNG`, `rect` of the stage, all of
// it without, as it would be seen were `laid` what is on it, made from what each page draws, a page under another
// whole, a material and a hidden page leaving nothing, `scale` pixels a point; `close()`, the stage ended, its pages
// taken off and it out of its window. Where a page laid on it, or a surface it opened, marks itself with `--app-region:
// drag`, a press drags the window it is in and a double click does what the person set a title bar's to do, unless what
// draws in that document took its drags (SHELL_PAGE.drags); `--app-region: no-drag` marks what inside it takes presses
// itself.
const STAGE = Object.freeze({
    place: 'function',
    size: 'function',
    whenResized: 'function',
    show: 'function',
    lay: 'function',
    hit: 'function',
    capture: 'function',
    close: 'function',
});

export { SHELL, SHELL_PAGE, STAGE };
