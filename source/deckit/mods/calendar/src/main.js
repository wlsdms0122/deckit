const { calendar } = require('./calendar/calendar.js');
const { calendarView } = require('./calendar/view.js');
const { notice } = require('./notice/notice.js');

class Calendar {
    // What the view has put on screen for the function side to reach (calendar.js), while it is attached.
    screen = null;

    start(deckit) {
        const notices = notice(deckit);
        this.calendar = calendar({ deckit, screen: () => this.screen, notice: notices });
        this.sendTest = () => sendTest(deckit, notices);
        deckit.commands.register({ 'send-test': { run: this.sendTest } });
        deckit.exports.register('calendar/accounts', {
            connect: (connection) => ({
                setProvider: (provider) => {
                    this.calendar.setProvider(connection, provider);
                },
            }),
            disconnect: (connection) => this.calendar.dropProvider(connection),
        });
    }

    stop() {
        this.calendar?.stop();
    }

    attach(shell, deckit) {
        this.view = calendarView({ calendar: this.calendar, shell, deckit, sendTest: this.sendTest });
        const { content, sidebar, didAppear, didDisappear, keys, commands, actions } = this.view;
        shell.view.register({ content, sidebar, didAppear, didDisappear });
        deckit.keys.register(keys);
        deckit.commands.register(commands);
        deckit.dependencies.onConnect('switcher/actions', (quickSwitcher) => quickSwitcher.setActions(actions));
        deckit.dependencies.onConnect('settings/buttons', (settings) =>
            settings.setButtons({
                list: () => [
                    {
                        button: 'Send a test',
                        hint: 'Shows one now, to see that macOS lets it through.',
                        after: 'notify',
                        value: 'send-test',
                    },
                ],
                run: this.sendTest,
            })
        );
        this.screen = this.view.screen;
    }

    detach() {
        this.screen = null;
        this.view?.end();
        this.view = null;
    }
}

module.exports = Calendar;

// Posts a notice the way a reminder looks, and answers what the person reads of how it went. A press on it shows
// Calendar on today.
async function sendTest(deckit, notices) {
    let posted = false;
    try {
        posted = await notices.post({
            title: 'Calendar',
            body: 'This is what a reminder looks like',
            date: new Date(),
        });
    } catch {}
    // macOS reports a notice as shown even when its settings keep it off the screen.
    return posted
        ? `Sent. If none appeared, allow ${deckit.about().name} in System Settings › Notifications.`
        : 'Not sent: no mod shows notifications now.';
}
