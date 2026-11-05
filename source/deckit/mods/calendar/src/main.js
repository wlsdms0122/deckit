const { calendar } = require('./calendar/calendar.js');
const { calendarView } = require('./calendar/view.js');
const { REMINDER_LEADS, DEFAULT_LEAD, leadText } = require('./reminder/reminder.js');

class Calendar {
    static configuration = {
        notify: {
            type: 'string',
            title: 'Notify me',
            description:
                "Meetings you are invited to, and every event on your own calendars. A calendar's ✎ changes which it is. A hidden calendar reminds too.",
            default: String(DEFAULT_LEAD),
            oneOf: [
                { const: 'off', title: leadText(null) },
                ...REMINDER_LEADS.map((lead) => ({ const: String(lead), title: leadText(lead) })),
            ],
        },
    };

    // What the view has put on screen for the function side to reach (calendar.js), while it is attached.
    screen = null;

    start(deckit) {
        this.calendar = calendar({ deckit, screen: () => this.screen });
        this.sendTest = () => sendTest(deckit, () => this.screen?.reveal());
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

// Shows a notification the way a reminder looks, and answers what the person reads of how it went. A click on it
// calls `reveal()`.
async function sendTest(deckit, reveal) {
    let shown = false;
    try {
        shown = await deckit.notify({
            title: 'Calendar',
            body: 'This is what a reminder looks like',
            onClick: reveal,
        });
    } catch {}
    // macOS reports a notice as shown even when its settings keep it off the screen.
    return (
        (shown ? 'Sent. ' : 'Not shown. ') +
        `If none appeared, allow ${deckit.about().name} in System Settings › Notifications.`
    );
}
