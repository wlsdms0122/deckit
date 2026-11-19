// Run in the app under test before its own entry: the app never becomes the active one, so it never takes the person's
// menu bar, keyboard or pointer. It has no Dock icon or menu bar of its own, and the system, which opened it in the
// background, leaves the app in front where it is as its windows ask to come forward. The test drives it through its
// main process and WebKit's module, which need none of that. It raises none of the system's notifications either: the
// system answers that it has none, so one asked of it is not shown. It shows no message box: each is held in
// `globalThis.deckitTestBoxes`, `{ message, buttons, answer(index) }`, until the test answers it or it is put away.
if (process.type === 'browser') {
    const { app } = require('electron');
    const keepOut = () => app.setActivationPolicy('accessory');
    // What its web pages download goes to the test's own folder, never the person's Downloads.
    const downloads = require('path').join(process.env.DECKIT_DATA, 'downloads');
    require('fs').mkdirSync(downloads, { recursive: true });
    app.setPath('downloads', downloads);
    if (app.isReady()) keepOut();
    else app.once('ready', keepOut);
    app.focus = () => {};
    // A hotkey would take a chord from every app the person uses: none is held, and deckit's keys are heard in its
    // pages alone.
    const { globalShortcut } = require('electron');
    globalShortcut.register = () => true;
    globalShortcut.unregister = () => {};
    const { Notification } = require('electron');
    Notification.isSupported = () => false;
    Notification.prototype.show = () => {};
    const { dialog } = require('electron');
    const boxes = (globalThis.deckitTestBoxes = []);
    dialog.showMessageBox = (...given) => {
        const { message, buttons = [], cancelId = 0, signal } = given.at(-1);
        return new Promise((resolve) => {
            const box = {
                message,
                buttons,
                answer: (response) => {
                    if (boxes.includes(box)) boxes.splice(boxes.indexOf(box), 1);
                    resolve({ response, checkboxChecked: false });
                },
            };
            boxes.push(box);
            signal?.addEventListener('abort', () => box.answer(cancelId));
        });
    };
}
