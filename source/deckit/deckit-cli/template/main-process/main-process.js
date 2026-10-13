// @@NAME@@: a module of the app's main process, for what a sandbox cannot do. The plugin calls its methods through
// what deck.mainProcess('main-process.js') gives it.
module.exports = ({ emit }) => ({
    async ping(what) {
        return { pong: what ?? null, at: Date.now() };
    },
    // Told without being asked, to the plugin's on('woke', …):
    // emit('woke', reason);
});
