const { calendar } = require('./calendar/calendar.js');
const { REMINDER_LEADS, DEFAULT_LEAD, leadText } = require('./reminder/reminder.js');

module.exports = {
    keywords: ['캘린더', '일정', '달력', 'calendar', 'schedule'],
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/><path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/></svg>`,

    settings: {
        notify: {
            label: 'Notify me',
            type: 'choice',
            default: DEFAULT_LEAD,
            hint: "Meetings you are invited to, and every event on your own calendars. A calendar's ✎ changes which it is. A hidden calendar reminds too.",
            options: [
                { value: 'off', label: leadText(null) },
                ...REMINDER_LEADS.map((lead) => ({ value: lead, label: leadText(lead) })),
            ],
        },
    },

    start(deck) {
        const { content, sidebar, ask, didAppear, didDisappear, commands, keys, actions } = calendar({
            deck,
            accountsPoint: deck.extensionPoint('accounts'),
            sendTest: () => sendTest(deck),
        });
        deck.view({ content, sidebar, didAppear, didDisappear });
        deck.commands({
            ...commands,
            'send-test': {
                description:
                    'Shows a notification now, to see that macOS lets it through. Answers what came of it, as text.',
                run: () => sendTest(deck),
            },
        });
        deck.keys(keys);
        deck.extends.switcher({ actions });
        deck.extends.settings({
            actions: {
                list: () => [
                    {
                        button: 'Send a test',
                        hint: 'Shows one now, to see that macOS lets it through.',
                        after: 'notify',
                        value: 'send-test',
                    },
                ],
                run: () => sendTest(deck),
            },
        });
        deck.exports({ ask });
    },
};

// Shows a notification the way a reminder looks, and answers what the person reads of how it went.
async function sendTest(deck) {
    let shown = false;
    try {
        shown = await deck.notify({
            title: 'Calendar',
            body: 'This is what a reminder looks like',
            onClick: () => deck.show(),
        });
    } catch {}
    // macOS reports a notice as shown even when its settings keep it off the screen.
    return (
        (shown ? 'Sent. ' : 'Not shown. ') +
        `If none appeared, allow ${deck.about().name} in System Settings › Notifications.`
    );
}
