// Run in the app under test before its own entry: the app never becomes the active one, so it never takes the
// person's menu bar, keyboard or pointer. It has no Dock icon or menu bar of its own, and macOS, which opened it in the
// background, leaves the app in front where it is as its windows ask to come forward. The test drives it through its
// main process and WebKit's module, which need none of that.
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
}
