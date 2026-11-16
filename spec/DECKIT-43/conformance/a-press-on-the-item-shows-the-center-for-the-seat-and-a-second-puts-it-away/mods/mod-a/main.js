// The probe of DECKIT-43's cases: it posts to deckit/notifications what the event post tells it, takes its own away
// as the event clear tells it, and runs a command it declares by saying so.
module.exports = class {
    start(deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        let notifications = null;
        deckit.dependencies.onConnect('deckit/notifications', (connected) => {
            notifications = connected;
            return () => (notifications = null);
        });
        deckit.events.on('mod-a:post', (notification) => notifications.post(notification));
        deckit.events.on('mod-a:clear', async () => {
            for (const { id } of await notifications.list()) await notifications.remove(id);
        });
        deckit.exports.register({ connect: () => ({ runCommand: (id) => say('mod-a/ran/' + id) }) });
    }
};
