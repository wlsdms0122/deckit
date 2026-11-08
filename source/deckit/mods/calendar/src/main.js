const { calendar } = require('./calendar/calendar.js');
const { calendarView } = require('./calendar/view.js');
const { notice } = require('./notice/notice.js');
const { settingsOf } = require('./settings/settings.js');

class Calendar {
    // What the view has put on screen for the function side (calendar.js), the commands and reopen() to reach, while
    // it is attached.
    screen = null;

    // The commands its manifest declares to `deckit/commands` are taken from the exports for its id: Send a test runs
    // with no screen, and the others on the view in its window, open or not, `show-date` opening the window, failing,
    // saying so, while Calendar is not attached.
    start(deckit) {
        const onScreen = () => {
            if (!this.screen) throw new Error('Calendar has no window to open');
            return this.screen;
        };
        const settings = settingsOf();
        deckit.dependencies.onConnect('deckit/configuration', (configuration) => settings.connect(configuration));
        const notices = notice(deckit);
        this.calendar = calendar({ deckit, settings, screen: () => this.screen, notice: notices });
        this.sendTest = () => sendTest(deckit, notices);
        const commands = {
            'send-test': this.sendTest,
            'show-date': (args) => {
                const screen = onScreen();
                screen.goToDate(args);
                screen.openWindow();
            },
            'go-to-date': (args) => onScreen().goToDate(args),
            'show-view': (args) => onScreen().showView(args),
        };
        deckit.exports.register({
            connect: () => ({
                runCommand: async (id, args) => {
                    if (!Object.hasOwn(commands, id)) throw new Error(`Calendar has no command ${id}`);
                    return (await commands[id](args ?? {})) ?? null;
                },
            }),
        });
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
        this.view.openWindow();
        const { actions } = this.view;
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

    // Its Dock item pressed while its window is closed.
    reopen() {
        this.screen?.openWindow();
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
