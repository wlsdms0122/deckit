const { providerIcon } = require('./provider-icon.js');
const { asksToSignIn } = require('./provider-client.js');
const { keyOf } = require('./store.js');

// Distinct enough to tell apart on both light and dark themes, and readable under white text.
const PALETTE = [
    '#4b8bf4',
    '#e8674f',
    '#43a047',
    '#ab47bc',
    '#f4a63a',
    '#00a3a3',
    '#7986cb',
    '#d81b60',
    '#795548',
    '#546e7a',
];

// The sheets and dialogs that add an account, sign it in again, choose its calendars and remove it, and that edit or
// remove a calendar. `onRefresh()` reads every calendar again.
function accountEditor({ ui, accounts, feeds, reads, client, onChange, onRefresh }) {
    return { addAccount, openAccount, signInAgain, editCalendar, removeCalendar };

    function addAccount() {
        const handle = ui.modal({
            title: 'Add account',
            confirmLabel: null,
            fill(card) {
                if (!Object.keys(client.providers()).length) {
                    card.appendChild(
                        sheetText(
                            'No mod adds accounts yet. A mod that extends Calendar with an account provider, such as one for Google, shows here.',
                            {
                                opacity: '.7',
                                marginBottom: '14px',
                            }
                        )
                    );
                    return;
                }
                for (const [id, provider] of Object.entries(client.providers())) {
                    const row = ui.row().element;
                    Object.assign(row.style, {
                        minHeight: '44px',
                        gap: '12px',
                        marginBottom: '6px',
                        border: 'var(--deckit-border)',
                    });
                    const words = document.createElement('div');
                    words.style.flex = '1 1 auto';
                    words.append(
                        sheetText(provider.name, { font: '600 14px var(--deckit-font)' }),
                        sheetText(provider.hint, { opacity: '.6', font: '12px var(--deckit-font)' })
                    );
                    row.append(providerIcon(ui, provider.icon, 22), words);
                    row.addEventListener('click', () => {
                        handle.close();
                        connect(id);
                    });
                    card.appendChild(row);
                }
                card.lastChild.style.marginBottom = '14px';
            },
        });
    }

    async function connect(providerId) {
        const provider = client.providers()[providerId];
        if (!provider) return;
        const account = { id: Date.now().toString(36), provider: providerId, email: '' };
        let email;
        try {
            email = await client.signIn(provider, account, `Add ${provider.name} account`);
        } catch (error) {
            return ui.dialog({ title: 'Add account', message: String(error.message || error), confirmLabel: 'OK' });
        }
        if (!email) return;
        const same = accounts.all().find((existing) => existing.provider === providerId && existing.email === email);
        if (same) {
            client.forget(account);
            return openAccount(same);
        }
        account.email = email;
        accounts.save([...accounts.all(), account]);
        onChange();
        openAccount(account, { fresh: true });
    }

    // Signing an account back in has to end on the same person, or it is not that account.
    async function signInAgain(account) {
        const provider = client.providerOf(account);
        if (!provider) return;
        let email;
        try {
            email = await client.signIn(provider, account, `Sign in to ${account.email}`);
        } catch (error) {
            return ui.dialog({ title: 'Sign in', message: String(error.message || error), confirmLabel: 'OK' });
        }
        if (!email) return;
        if (email !== account.email) {
            await client.forget(account);
            return ui.dialog({
                title: 'Different account',
                message: `That signed in as ${email || 'someone else'}, not ${account.email}. Sign in again with ${account.email}.`,
                confirmLabel: 'OK',
            });
        }
        // What was read stays until the next read replaces it: if that read fails, it is all there is.
        onRefresh();
    }

    async function removeAccount(account) {
        accounts.save(accounts.all().filter((existing) => existing.id !== account.id));
        // feeds.all() leaves out the removed account's calendars.
        feeds.save(feeds.all());
        reads.dropAccount(account.id);
        onChange();
        await client.forget(account);
    }

    // A new account starts with the calendars its own calendar app shows.
    function openAccount(account, { fresh = false } = {}) {
        const provider = client.providerOf(account) || { name: account.provider, icon: ui.icon('info') };
        const shown = new Set(
            feeds
                .all()
                .filter((feed) => feed.account === account.id)
                .map((feed) => feed.calendar)
        );
        let calendars = null;
        const chosen = new Map();
        const handle = ui.modal({
            title: account.email,
            confirmLabel: 'Done',
            fill(card) {
                const who = document.createElement('div');
                Object.assign(who.style, { display: 'flex', alignItems: 'center', gap: '8px', margin: '-6px 0 14px' });
                who.append(providerIcon(ui, provider.icon, 16), sheetText(provider.name, { opacity: '.6' }));
                const heading = sheetText('Calendars', {
                    font: '700 12px var(--deckit-font)',
                    opacity: '.55',
                    letterSpacing: '.02em',
                    marginBottom: '6px',
                });
                const list = document.createElement('div');
                const loadingRow = () => ui.loading({ text: 'Loading calendars…' }).element;
                list.appendChild(loadingRow());
                const remove = ui.button({
                    label: 'Remove account',
                    size: 'small',
                    onClick: () => {
                        handle.close();
                        ui.dialog({
                            title: 'Remove account',
                            message: `${account.email} is signed out here and its calendars stop showing. Nothing changes in ${provider.name}.`,
                            confirmLabel: 'Remove',
                            destructive: true,
                            onConfirm: () => removeAccount(account),
                        });
                    },
                }).element;
                Object.assign(remove.style, {
                    display: 'inline-flex',
                    margin: '14px 0 6px',
                    color: 'var(--deckit-alert)',
                });
                card.append(who, heading, list, remove);

                const load = () =>
                    client
                        .calendars(account)
                        .then((found) => {
                            calendars = found;
                            list.textContent = '';
                            for (const entry of found) {
                                chosen.set(
                                    entry.id,
                                    shown.has(entry.id) || (fresh && (entry.primary || entry.selected))
                                );
                                list.appendChild(calendarRow(entry, chosen));
                            }
                        })
                        .catch((error) => {
                            list.textContent = '';
                            list.appendChild(
                                sheetText(String(error.message || error), {
                                    color: 'var(--deckit-alert)',
                                    marginBottom: '8px',
                                })
                            );
                            if (asksToSignIn(error)) {
                                list.appendChild(
                                    ui.button({
                                        label: 'Sign in',
                                        title: 'Sign in again',
                                        onClick: () => {
                                            handle.close();
                                            signInAgain(account);
                                        },
                                    }).element
                                );
                            } else {
                                list.appendChild(
                                    ui.button({
                                        label: 'Try again',
                                        title: 'Load the calendars again',
                                        onClick: () => {
                                            list.textContent = '';
                                            list.appendChild(loadingRow());
                                            load();
                                        },
                                    }).element
                                );
                            }
                        });
                load();
            },
            onConfirm: () => {
                if (!calendars) return;
                let list = feeds.all();
                for (const entry of calendars) {
                    const has = list.some((feed) => feed.account === account.id && feed.calendar === entry.id);
                    // The palette rather than the provider's colours, which are pastels made for white pages, not for white text.
                    if (chosen.get(entry.id) && !has) {
                        list.push({
                            account: account.id,
                            calendar: entry.id,
                            label: entry.name,
                            color: PALETTE[list.length % PALETTE.length],
                            hidden: false,
                            remindAll: !!(entry.owned || entry.primary),
                        });
                    } else if (!chosen.get(entry.id) && has) {
                        list = list.filter((feed) => !(feed.account === account.id && feed.calendar === entry.id));
                        reads.dropFeed(keyOf({ account: account.id, calendar: entry.id }));
                    }
                }
                feeds.save(list);
                onRefresh();
            },
        });
    }

    function calendarRow(entry, chosen) {
        const row = document.createElement('div');
        Object.assign(row.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minHeight: '30px',
            marginBottom: '4px',
            cursor: 'pointer',
        });
        const name = sheetText(entry.name + (entry.primary ? ' (you)' : ''), {
            flex: '1 1 auto',
            font: '14px var(--deckit-font)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        });
        const toggle = ui.toggle({
            value: chosen.get(entry.id),
            onChange: (on) => {
                chosen.set(entry.id, on);
                toggle.set(on);
            },
        });
        row.addEventListener('click', (event) => {
            if (!toggle.element.contains(event.target)) toggle.element.click();
        });
        row.append(name, toggle.element);
        return row;
    }

    function editCalendar(feed) {
        ui.dialog({
            title: 'Edit calendar',
            fields: [
                { key: 'label', label: 'Name', value: feed.label || '' },
                { key: 'color', label: 'Color', type: 'color', value: feed.color, options: PALETTE },
                // Invitations remind either way.
                {
                    key: 'remindAll',
                    label: 'Notify for every event, not just invitations',
                    type: 'switch',
                    value: feeds.remindsAll(feed),
                },
            ],
            onConfirm: ({ label, color, remindAll }) => {
                feeds.update(keyOf(feed), { label: label.trim() || feed.label, color, remindAll });
                onChange();
            },
        });
    }

    function removeCalendar(feed) {
        ui.dialog({
            title: 'Remove calendar',
            message: `${feed.label || feed.calendar} will no longer be shown. The calendar itself is untouched.`,
            confirmLabel: 'Remove',
            destructive: true,
            onConfirm: () => {
                feeds.save(feeds.all().filter((other) => keyOf(other) !== keyOf(feed)));
                reads.dropFeed(keyOf(feed));
                onChange();
            },
        });
    }
}

function sheetText(text, style = {}) {
    const element = document.createElement('div');
    element.textContent = text;
    Object.assign(element.style, { font: '13px var(--deckit-font)', ...style });
    return element;
}

module.exports = { accountEditor };
