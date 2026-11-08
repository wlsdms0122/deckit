const { calendar } = require('./calendar/calendar.js');
const { calendarView } = require('./calendar/view.js');
const { notice } = require('./notice/notice.js');
const { onScreen } = require('./screen/on-screen.js');
const { settingsOf } = require('./settings/settings.js');

class Calendar {
    // What the view has put on screen for the function side (calendar.js) and the commands to reach, while it is
    // attached.
    screen = onScreen('Calendar');

    // The commands its manifest declares to `deckit/commands` are taken from the exports for its id: Send a test runs
    // with no screen, and the others on the view, failing, saying so, while Calendar has no view open.
    start(deckit) {
        const settings = settingsOf();
        deckit.dependencies.onConnect('deckit/configuration', (configuration) => settings.connect(configuration));
        const notices = notice(deckit);
        this.calendar = calendar({ deckit, settings, screen: () => this.screen.now(), notice: notices });
        this.sendTest = () => sendTest(deckit, notices);
        const commands = {
            'send-test': this.sendTest,
            'show-date': async (args) => {
                const screen = await this.screen.reach();
                screen.goToDate(args);
                screen.reveal();
            },
            'go-to-date': async (args) => (await this.screen.reach()).goToDate(args),
            'show-view': async (args) => (await this.screen.reach()).showView(args),
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
        const { content, sidebar, didAppear, didDisappear, actions } = this.view;
        shell.view.register({ content, sidebar, didAppear, didDisappear });
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
        this.screen.set(this.view.screen);
    }

    detach() {
        this.screen.set(null);
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
