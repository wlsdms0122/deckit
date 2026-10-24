// Run in the app under test before its own entry: the app never becomes the active one, so it never takes the
// person's menu bar, keyboard or pointer. It has no Dock icon or menu bar of its own, its windows show without
// activating, float over no other app's and let the pointer through, and a focus stays inside the app. The test
// drives it through the DevTools protocol, which needs none of that.
if (process.type === 'browser') {
    const { app, BrowserWindow } = require('electron');
    const keepOut = () => app.setActivationPolicy('accessory');
    if (app.isReady()) keepOut();
    else app.once('ready', keepOut);
    BrowserWindow.prototype.show = function () {
        this.setAlwaysOnTop(false);
        this.setIgnoreMouseEvents(true);
        this.showInactive();
    };
    BrowserWindow.prototype.focus = function () {};
    app.focus = () => {};
    // A hotkey would take a chord from every app the person uses: none is held, and deckit's keys are heard in its
    // pages alone.
    const { globalShortcut } = require('electron');
    globalShortcut.register = () => true;
    globalShortcut.unregister = () => {};
    // A page's focus would focus its window, which activates the app on macOS.
    app.on('web-contents-created', (_event, contents) => {
        contents.focus = () => {};
    });
}
