// The windows pages are laid in, the module's, which the host app opens and frames (`windows`, the host app's), and a
// window of the app's for a page of deckit's own, which the host app is asked for (`openWindow`).
export function createWindows({ LOG, WEBKIT, openWindow }) {
    // MARK: - Property
    const ids = new WeakMap(); // window -> its id in the module
    const byId = new Map(); // id -> window, while it is open

    // MARK: - Initializer
    // MARK: - Public
    // A window, hidden until shown: `kind` `titled`, with macOS's title bar, its buttons where `buttons` puts the
    // first's top left and its title shown with `showsTitle`, or `floating`, with no bar, over every app and on every
    // Space, taking the keyboard without bringing the app forward; `size` its content's; `frame` where it is on screen,
    // `{ x, y, width, height }` from the top left of the main display as Electron's screen gives it; `color` `{ red,
    // green, blue }` under what it shows, or `material` (`hud`, `sidebar`, `menu`, `popover`) blurring what is behind
    // it instead. It tells `resize` ({ width, height }, its content's size), `moving`, before the person moves it,
    // `moved`, `key` and `resign`, as it takes and loses the keyboard, and `close`, once, as it closes.
    function open({
        kind = 'titled',
        size,
        frame = null,
        title = '',
        showsTitle = true,
        color = null,
        material = null,
        buttons = null,
    }) {
        const { EventEmitter } = require('events');
        const events = new EventEmitter();
        let closed = false;
        const listener = (event, payload) => {
            if (event === 'close') {
                closed = true;
                byId.delete(id);
            }
            try {
                events.emit(event, payload);
            } catch (error) {
                LOG.error(`a window's ${event} failed`, error);
            }
            if (event === 'close') events.removeAllListeners();
        };
        const native = WEBKIT.native();
        const id = native.openWindow({ kind, size, title, showsTitle, color, material, buttons }, listener);
        const live =
            (act) =>
            (...args) =>
                closed ? undefined : act(...args);
        const window = Object.freeze({
            show: live(({ focus = true } = {}) => native.showWindow(id, { focus })),
            hide: live(() => native.hideWindow(id)),
            close: live(() => native.closeWindow(id)),
            isClosed: () => closed,
            isKey: () => !closed && native.keyWindow() === id,
            frame: () => (closed ? null : native.windowFrame(id)),
            setFrame: live((rect) => native.setWindowFrame(id, rect)),
            size: () => (closed ? { width: 0, height: 0 } : native.windowSize(id)),
            setSize: live((size) => native.setWindowSize(id, size)),
            setTitle: live((text) => native.setTitle(id, String(text))),
            setColor: live((given) => native.setColor(id, given)),
            // Quick Look's panel showing `file`, titled `title`, over the window, and closed.
            previewFile: live((file, title) => native.previewFile(id, String(file), String(title))),
            closeFilePreview: live(() => native.closeFilePreview(id)),
            // Electron's dialogs as a sheet on the window, with the options and answers of Electron's `dialog`.
            showOpenDialog: async (options = {}) => {
                const filePaths = closed ? [] : await native.showOpenDialog(id, openPanel(options));
                return { canceled: !filePaths.length, filePaths };
            },
            showSaveDialog: async (options = {}) => {
                const filePath = closed ? null : await native.showSaveDialog(id, savePanel(options));
                return { canceled: !filePath, filePath: filePath || '' };
            },
            // `listener` hears `event` until the off this answers is called, or the window closes.
            on: (event, heard) => {
                events.on(event, heard);
                return () => events.removeListener(event, heard);
            },
        });
        ids.set(window, id);
        byId.set(id, window);
        if (frame) window.setFrame(frame);
        return window;
    }

    // The window with the keyboard, or null while none of the app's has it.
    function focused() {
        const id = WEBKIT.native().keyWindow();
        return id === null || id === undefined ? null : byId.get(id) || null;
    }

    function idOf(window) {
        return ids.get(window) ?? null;
    }

    // A window of the app's for what deckit shows on its own, a web page's, of `size`, titled `title`: the host app
    // opens and frames it, and puts the stage where it says (`place`).
    function openForStage({ title = '', size = null, stage, onClose = null }) {
        return openWindow({
            title,
            size,
            place: (window, { bounds = null } = {}) => stage.place(window, { bounds, onClose }),
        });
    }

    // MARK: - Private
    // Of Electron's options, `title`, `message`, `buttonLabel`, `defaultPath` and `properties`, as NSOpenPanel takes
    // them; Electron opens files when no property says what.
    function openPanel({ properties = ['openFile'], ...options }) {
        return {
            ...savePanel({ properties, ...options }),
            canChooseFiles: properties.includes('openFile'),
            canChooseDirectories: properties.includes('openDirectory'),
            allowsMultipleSelection: properties.includes('multiSelections'),
        };
    }

    // `defaultPath` opens in the folder it names, or names a file in the folder it is in.
    function savePanel({ title, message, buttonLabel, defaultPath, properties = [] }) {
        const path = require('path');
        const at = defaultPath ? String(defaultPath) : '';
        const where = !at
            ? {}
            : isFolder(at)
              ? { directory: at }
              : { directory: path.isAbsolute(at) ? path.dirname(at) : undefined, name: path.basename(at) };
        return {
            title,
            message,
            prompt: buttonLabel,
            ...where,
            canCreateDirectories: properties.includes('createDirectory'),
            showsHiddenFiles: properties.includes('showHiddenFiles'),
        };
    }

    function isFolder(at) {
        try {
            return require('fs').statSync(at).isDirectory();
        } catch {
            return false;
        }
    }

    return { windows: Object.freeze({ open, focused }), idOf, openForStage };
}
