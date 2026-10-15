const { WEEKDAYS, clockText } = require('./date.js');
const { nameOf, isSpanning } = require('./occurrence.js');
const { paintPast, paintDot, paintText } = require('./paint.js');
const { providerIcon } = require('./provider-icon.js');
const { keyOf } = require('./store.js');

// The sidebar: each account and its calendars, which a click shows or hides, then what is on today and what comes in
// the next two weeks.
function sidebar({ ui, values, accounts, feeds, reads, client, editor, detail, onChange }) {
    const element = document.createElement('div');
    Object.assign(element.style, { display: 'flex', flexDirection: 'column', minHeight: '0', flex: '1 1 auto' });
    const accountList = document.createElement('div');
    // One block per account: its row, then its calendars as a keyed list, reordered within the account only. Blocks
    // are kept from one draw to the next, so a drag holds the list that is drawn into and the redraw waits for the
    // drop.
    const blocks = new Map(); // account id -> { element, row, list }

    const feedSection = foldingSection('Calendars', 'layers', 'calendars', [
        { title: 'Add account', run: () => editor.addAccount() },
    ]);
    const todaySection = foldingSection('Today', 'calendarDays', 'today');
    // Drawn whole: a row leaving means only that time moved, so it does not fold away.
    const todayList = document.createElement('div');
    const upcomingSection = foldingSection('Upcoming', 'clock', 'upcoming');
    const upcomingList = document.createElement('div');
    feedSection.body.appendChild(accountList);
    todaySection.body.appendChild(todayList);
    upcomingSection.body.appendChild(upcomingList);
    element.append(feedSection.element, todaySection.element, upcomingSection.element);

    ui.contextMenu(accountList, {
        rowAt: (target) => target.closest?.('[data-feed]') || null,
        items: (row) => {
            const feed = row && feeds.all().find((candidate) => keyOf(candidate) === row.dataset.feed);
            if (!feed) return null;
            return [
                {
                    label: feed.hidden ? 'Show' : 'Hide',
                    icon: feed.hidden ? 'eye' : 'eyeOff',
                    run: () => setHidden(feed, !feed.hidden),
                },
                {
                    label: 'Show Only This',
                    icon: 'eye',
                    run: () => {
                        feeds.save(feeds.all().map((other) => ({ ...other, hidden: keyOf(other) !== keyOf(feed) })));
                        onChange();
                    },
                },
                '-',
                { label: 'Edit Name and Color…', icon: 'pencil', run: () => editor.editCalendar(feed) },
                { label: 'Remove…', icon: 'x', run: () => editor.removeCalendar(feed) },
            ];
        },
    });

    return { element, draw };

    // `today` and `upcoming` are the occurrences of the two agenda sections.
    function draw({ today, upcoming }) {
        drawAccounts();
        todayList.textContent = '';
        upcomingList.textContent = '';
        const has = feeds.all().length > 0;
        todaySection.element.style.display = has ? '' : 'none';
        upcomingSection.element.style.display = has ? '' : 'none';
        if (!has) return;
        if (today.length) for (const occurrence of today) todayList.appendChild(agendaRow(occurrence, false));
        else todayList.appendChild(emptyRow('Nothing today'));
        if (upcoming.length) for (const occurrence of upcoming) upcomingList.appendChild(agendaRow(occurrence, true));
        else upcomingList.appendChild(emptyRow('Nothing in the next two weeks'));
    }

    function drawAccounts() {
        const shown = accounts.all();
        for (const [id, block] of blocks)
            if (!shown.some((account) => account.id === id)) {
                block.element.remove();
                blocks.delete(id);
            }
        const all = feeds.all();
        const order = shown.map((account) => {
            const block = blockOf(account);
            const row = accountRow(account);
            if (block.row) block.row.replaceWith(row);
            else block.element.prepend(row);
            block.row = row;
            block.list.set(
                all
                    .filter((feed) => feed.account === account.id)
                    .map((feed) => ({
                        ...feed,
                        key: keyOf(feed),
                        // An account waiting for its provider says so on its own row, not as a calendar's failure.
                        error: (client.providerOf(account) && reads.of(feed)?.error) || '',
                    }))
            );
            return block.element;
        });
        if (
            order.length !== accountList.children.length ||
            order.some((child, index) => accountList.children[index] !== child)
        ) {
            accountList.replaceChildren(...order);
        }
    }

    function blockOf(account) {
        if (blocks.has(account.id)) return blocks.get(account.id);
        const list = ui.list({ key: (item) => item.key, create: feedRow, animated: true });
        ui.sortable(list, {
            onReorder: (key, toKey) => {
                const mine = feeds.all().filter((feed) => feed.account === account.id);
                const from = mine.findIndex((feed) => keyOf(feed) === key);
                const to = mine.findIndex((feed) => keyOf(feed) === toKey);
                if (from < 0 || to < 0) return;
                mine.splice(to, 0, ...mine.splice(from, 1));
                let next = 0;
                feeds.save(feeds.all().map((feed) => (feed.account === account.id ? mine[next++] : feed)));
                onChange();
            },
        });
        const holder = document.createElement('div');
        holder.append(list.element);
        const block = { element: holder, row: null, list };
        blocks.set(account.id, block);
        return block;
    }

    function accountRow(account) {
        const row = ui.row().element;
        Object.assign(row.style, { minHeight: '24px', font: '12.5px var(--deckit-font)' });
        const who = document.createElement('span');
        who.textContent = account.email;
        const provider = client.providerOf(account);
        who.title = (provider ? provider.name : `${account.provider}, not running`) + ' · ' + account.email;
        Object.assign(who.style, {
            flex: '1 1 auto',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: '.6',
        });
        row.append(providerIcon(ui, provider ? provider.icon : ui.icon('info'), 13), who);
        const reading = reads.isReading(account.id);
        if (reading) row.appendChild(ui.spinner({ size: 12 }).element);
        // A button: a rowAction shows only on hover, and this has to be seen.
        if (reads.isSignedOut(account.id) && !reading) {
            const signInButton = ui.button({
                label: 'Sign in',
                title: 'Signed out. Sign in again',
                size: 'small',
                onClick: (event) => {
                    event.stopPropagation();
                    editor.signInAgain(account);
                },
            }).element;
            Object.assign(signInButton.style, { color: 'var(--deckit-alert)', borderColor: 'var(--deckit-alert)' });
            row.appendChild(signInButton);
        }
        row.appendChild(
            ui.rowAction({ icon: ui.icon('gear'), title: 'Account', onClick: () => editor.openAccount(account) })
                .element
        );
        row.addEventListener('click', () => editor.openAccount(account));
        return row;
    }

    // `feed` is the keyed list's item, its error included, so a change to either draws it again.
    function feedRow(feed) {
        const row = ui.row().element;
        const swatch = document.createElement('span');
        Object.assign(swatch.style, {
            flex: '0 0 auto',
            width: '10px',
            height: '10px',
            borderRadius: '3px',
            background: feed.hidden ? 'transparent' : feed.color,
            border: '1.5px solid ' + feed.color,
            boxSizing: 'border-box',
            transition:
                'background-color var(--deckit-base) var(--deckit-easing), border-color var(--deckit-base) var(--deckit-easing)',
        });
        const label = document.createElement('span');
        label.textContent = feed.label || feed.calendar;
        label.title = feed.error ? 'Failed to load: ' + feed.error : feed.calendar;
        Object.assign(label.style, {
            flex: '1 1 auto',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: feed.hidden ? '.45' : '1',
            color: feed.error ? 'var(--deckit-alert)' : 'inherit',
        });
        row.append(
            swatch,
            label,
            ui.rowAction({
                icon: ui.icon('pencil'),
                title: 'Edit name and color',
                onClick: () => editor.editCalendar(feed),
            }).element,
            ui.rowAction({ icon: ui.icon('x'), title: 'Remove', onClick: () => editor.removeCalendar(feed) }).element
        );
        row.dataset.feed = keyOf(feed);
        row.addEventListener('click', () => setHidden(feed, !feed.hidden));
        return row;
    }

    function setHidden(feed, hidden) {
        feeds.update(keyOf(feed), { hidden });
        onChange();
    }

    // The date and time cells keep their width when empty, so an all-day entry lines up with a timed one.
    function agendaRow(occurrence, showDate) {
        const row = ui.row().element;
        const dot = document.createElement('span');
        Object.assign(dot.style, {
            flex: '0 0 auto',
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: occurrence.color,
        });
        paintDot(dot, occurrence);
        row.appendChild(dot);
        if (showDate) {
            const date = document.createElement('span');
            date.textContent = `${occurrence.start.getMonth() + 1}/${occurrence.start.getDate()} (${WEEKDAYS[occurrence.start.getDay()]})`;
            Object.assign(date.style, {
                flex: '0 0 auto',
                width: '76px',
                opacity: '.55',
                font: '13px var(--deckit-font)',
            });
            row.appendChild(date);
        }
        const time = document.createElement('span');
        const spanning = isSpanning(occurrence);
        time.textContent = spanning ? 'All day' : clockText(occurrence.start);
        Object.assign(time.style, {
            flex: '0 0 auto',
            width: '52px',
            opacity: spanning ? '.45' : '.6',
            font: (spanning ? '12px' : '13px') + ' var(--deckit-font)',
        });
        const name = document.createElement('span');
        name.textContent = nameOf(occurrence);
        name.title = occurrence.summary || '';
        Object.assign(name.style, {
            flex: '1 1 auto',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        });
        paintText(name, occurrence);
        row.append(time, name);
        paintPast(row, occurrence);
        row.addEventListener('click', () => detail.show(occurrence, row));
        return row;
    }

    function emptyRow(text) {
        const row = ui.row().element;
        row.textContent = text;
        Object.assign(row.style, { opacity: '.45', cursor: 'default', font: '13px var(--deckit-font)' });
        return row;
    }

    function foldingSection(label, icon, key, actions = []) {
        const section = ui.section({
            label,
            icon: ui.icon(icon, { size: 16 }),
            actions,
            collapsed: !!values.get('folds', {})[key],
            onToggle: (next) => {
                values.set('folds', { ...values.get('folds', {}), [key]: next });
                section.setCollapsed(next);
            },
        });
        return section;
    }
}

module.exports = { sidebar };
