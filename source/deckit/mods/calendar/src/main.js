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
    static icon = `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/><path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/></svg>`;
    static keywords = ['캘린더', '일정', '달력', 'calendar', 'schedule'];

    // What the view has put on screen for the function side to reach (calendar.js), while it is attached.
    screen = null;

    start(deckit) {
        this.calendar = calendar({
            deckit,
            accountsPoint: deckit.extensionPoint('accounts'),
            screen: () => this.screen,
        });
        this.sendTest = () => sendTest(deckit, () => this.screen?.reveal());
        deckit.commands({
            ...this.calendar.commands,
            'send-test': {
                description:
                    'Shows a notification now, to see that macOS lets it through. Answers what came of it, as text.',
                run: this.sendTest,
            },
        });
        deckit.exports({ ask: this.calendar.ask });
    }

    stop() {
        this.calendar?.stop();
    }

    attach(shell, deckit) {
        this.view = calendarView({ calendar: this.calendar, shell, deckit, sendTest: this.sendTest });
        const { content, sidebar, didAppear, didDisappear, keys, actions } = this.view;
        shell.view({ content, sidebar, didAppear, didDisappear });
        deckit.keys(keys);
        deckit.extends.switcher({ actions });
        deckit.extends.settings({
            actions: {
                list: () => [
                    {
                        button: 'Send a test',
                        hint: 'Shows one now, to see that macOS lets it through.',
                        after: 'notify',
                        value: 'send-test',
                    },
                ],
                run: this.sendTest,
            },
        });
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
