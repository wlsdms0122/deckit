const { dayText } = require('../date/date.js');

// Calendar's notices, posted to deckit/notifications while its owner is connected. A press brings Calendar forward on
// the notice's day, by the `show-date` command.
function notice(deckit) {
    let notifications = null;
    deckit.dependencies.onConnect('deckit/notifications', (connected) => {
        notifications = connected;
        return () => (notifications = null);
    });

    // Answers whether it was posted: false while no owner is connected. A post the owner refuses rejects.
    async function post({ title, body, date }) {
        if (!notifications) return false;
        const token = await deckit.commands.tokens.mint('show-date', { date: dayText(date) });
        try {
            await notifications.post({ title, body, token });
        } catch (error) {
            deckit.commands.tokens.cancel(token).catch(() => {});
            throw error;
        }
        return true;
    }

    return { post };
}

module.exports = { notice };
