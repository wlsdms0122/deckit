/* @@NAME@@: the main-process half. It runs in the app's main process, for what a page cannot do;
 * the view reaches it through context.main, only by the ops handled here. */
module.exports = ({ id, dir, data, handle, send, window }) => {
    handle('ping', async (what) => {
        // The result of main.call("ping", …) in the view.
        return { pong: what ?? null, at: Date.now() };
    });

    // Unasked, to the view's main.on("woke", …):
    // send("woke", reason);
};
