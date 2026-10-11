// @@NAME@@: the main-process half. It runs in the app's main process, for what a page cannot do. The view reaches it
// through context.main, by the ops handled here and no others.
module.exports = ({ id, folder, handle, send, window, files }) => {
    // What main.call('ping', …) answers in the view.
    handle('ping', async (what) => ({ pong: what ?? null, at: Date.now() }));

    // Told without being asked, to the view's main.on('woke', …):
    // send('woke', reason);
};
