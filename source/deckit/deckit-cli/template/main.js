// @@NAME@@: the main-process half. It runs in the app's main process, for what a page cannot do. The page reaches it
// through context.main, by the ops handled here and no others.
module.exports = ({ id, folder, handle, send, window, files }) => {
    // What main.call('ping', …) answers in the page.
    handle('ping', async (what) => ({ pong: what ?? null, at: Date.now() }));

    // Told without being asked, to the page's main.on('woke', …):
    // send('woke', reason);
};
