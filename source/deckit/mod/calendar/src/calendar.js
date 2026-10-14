const { accountEditor } = require('./account-editor.js');
const { WEEKDAYS, MONTHS, addDays, startOfDay, startOfWeek, clockText } = require('./date.js');
const { eventDetail } = require('./event-detail.js');
const { monthView } = require('./month-view.js');
const { providerClient } = require('./provider-client.js');
const { readCache } = require('./read-cache.js');
const { reminder } = require('./reminder.js');
const { sidebar } = require('./sidebar.js');
const { store } = require('./store.js');
const { switcher } = require('./switcher.js');
const { timeGridView } = require('./time-grid-view.js');

const MODES = [
    ['day', 'Day'],
    ['week', 'Week'],
    ['month', 'Month'],
];

// Calendar: the mode and the day on screen, which it hands to the view that draws them with their occurrences. An
// account is a provider's: a mod that extends the `accounts` point (README.md) signs it in, keeps what it signed in
// with, and reads its calendars. Calendar keeps which accounts there are and which of their calendars are shown.
function calendar({ deck, accountsPoint }) {
    const { theme, ui, settings } = deck;
    const { values } = deck.storage;
    // A failed write is shown on this mod's row in Settings.
    const records = {
        get: (key, fallback) => deck.storage.records.get(key, fallback),
        set: (key, value) => deck.storage.records.set(key, value).catch(() => {}),
    };

    let mode = MODES.some(([key]) => key === values.get('mode', '')) ? values.get('mode') : 'month';
    let cursor = startOfDay(new Date());
    // Drawing waits while the pane is hidden or the popover is up: a redraw takes the popover's anchor away.
    let visible = false;
    let drawPending = false;
    let drawnView = '';

    const { accounts, feeds } = store({ records });
    const client = providerClient({ deck, ui, records, accountsPoint, onSigningIn: render });
    const reads = readCache({ records, accounts, feeds, client, onChange: render, onRead });
    const reminders = reminder({ deck, settings, records, occurrences: shownBetween, onOpen: showDate });
    // A draw put off while the popover was up runs when it closes.
    const detail = eventDetail({
        ui,
        onAnswer: answer,
        onClose: () => {
            if (drawPending) setTimeout(render, 0);
        },
    });
    const editor = accountEditor({ ui, accounts, feeds, reads, client, onChange: render, onRefresh: () => read(true) });
    const month = monthView({ ui, detail, onOpenDay: (day) => goTo(day, 'day') });
    const timeGrid = timeGridView({ detail });
    const side = sidebar({ ui, values, accounts, feeds, reads, client, editor, detail, onChange: render });
    const { now, commands } = switcher({
        ui,
        show: () => deck.show(),
        modes: MODES,
        reminders,
        occurrences: shownBetween,
        onGoTo: goTo,
        onMode: setMode,
        onAddAccount: editor.addAccount,
    });

    const content = document.createElement('div');
    Object.assign(content.style, {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--deckit-text)',
        font: '14px var(--deckit-font)',
        position: 'relative',
        overflow: 'hidden',
    });

    const RELOAD = ui.icon('reload', { size: 15 });
    const head = document.createElement('div');
    Object.assign(head.style, {
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '9px 12px',
        borderBottom: 'var(--deckit-border)',
    });
    ui.titleBar(head);
    const title = document.createElement('div');
    Object.assign(title.style, { font: '700 16px var(--deckit-font)', padding: '0 8px', whiteSpace: 'nowrap' });
    const status = document.createElement('span');
    Object.assign(status.style, {
        flex: '1 1 auto',
        opacity: '.55',
        font: '12.5px var(--deckit-font)',
        paddingLeft: '6px',
    });
    const modeBar = ui.segmented({
        items: MODES.map(([key, label]) => ({ key, label, title: label + ' view' })),
        value: mode,
        onChange: (key) => setMode(key),
    });
    const reloadButton = ui.iconButton({ icon: RELOAD, title: 'Refresh', onClick: () => read(true) });
    let spinning = false;
    head.append(
        ui.iconButton({ icon: ui.icon('chevronLeft', { size: 17 }), title: 'Previous', onClick: () => shift(-1) })
            .element,
        ui.iconButton({ icon: ui.icon('chevronRight', { size: 17 }), title: 'Next', onClick: () => shift(1) }).element,
        title,
        status,
        reloadButton.element,
        ui.button({ label: 'Today', title: 'Jump to today', onClick: () => goTo(new Date()) }).element,
        modeBar.element
    );

    const body = document.createElement('div');
    Object.assign(body.style, {
        flex: '1 1 auto',
        minHeight: '0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    });

    const emptyAction = ui.button({
        label: 'Add account',
        size: 'small',
        onClick: () => {
            if (!accounts.all().length) editor.addAccount();
            else editor.openAccount(accounts.all()[0]);
        },
    });
    const emptyState = ui.emptyState({
        icon: ui.icon('calendar', { size: 44 }),
        title: 'No calendars yet',
        actions: [emptyAction.element],
    });
    const empty = emptyState.element;
    Object.assign(empty.style, { position: 'absolute', inset: '0', display: 'none' });

    const firstLoad = ui.loading({ text: 'Loading calendars…' }).element;
    Object.assign(firstLoad.style, { position: 'absolute', inset: '0', display: 'none' });

    content.append(head, body, firstLoad, empty);

    new ResizeObserver(() => {
        if (mode === 'month' && !month.fitsAsDrawn()) render();
    }).observe(body);

    // refresh() decides for itself whether a read is due, so asking every minute costs nothing.
    setInterval(() => {
        read();
        follow();
    }, 60 * 1000);

    render();
    // A provider that starts reads its accounts at once; one that ends leaves what was read.
    accountsPoint.onChange(() => {
        client.forgetWaiting();
        render();
        read(true);
    });
    read();

    // Being past changes with the clock alone, and so does the current-time line.
    setInterval(render, 60 * 1000);

    return {
        content,
        sidebar: side.element,
        ask: client.ask,
        didAppear() {
            visible = true;
            read();
            render();
            follow();
        },
        didDisappear() {
            visible = false;
            detail.close();
        },
        keys: {
            today: { key: 'mod+t', label: 'Go to today', run: () => goTo(new Date()) },
            dayView: { key: 'mod+1', label: 'Day view', run: () => setMode('day') },
            weekView: { key: 'mod+2', label: 'Week view', run: () => setMode('week') },
            monthView: { key: 'mod+3', label: 'Month view', run: () => setMode('month') },
            previous: { key: 'mod+left', label: 'Previous', run: () => shift(-1) },
            next: { key: 'mod+right', label: 'Next', run: () => shift(1) },
        },
        now,
        commands,
    };

    function render() {
        if (!visible || detail.isOpen()) {
            drawPending = true;
            return;
        }
        drawPending = false;
        const loading = reads.isLoading();
        title.textContent = titleOf(mode, cursor);
        modeBar.set(mode);
        showSpinner(loading);
        status.textContent = statusText(loading);

        const noAccount = !accounts.all().length,
            blank = !feeds.all().length;
        emptyState.set({
            title: noAccount ? 'No accounts yet' : 'No calendars shown',
            hint: noAccount
                ? 'Add an account, then choose which of its calendars to show. Subscribed calendars are there too.'
                : 'Choose which calendars of your account to show.',
        });
        emptyAction.setLabel(noAccount ? 'Add account' : 'Choose calendars');
        if (empty.style.display !== (blank ? 'flex' : 'none')) {
            empty.style.display = blank ? 'flex' : 'none';
            if (blank) fade(empty, theme.motion.base);
        }
        const firstRead = !blank && loading && feeds.all().every((feed) => !reads.has(feed));
        firstLoad.style.display = firstRead ? 'flex' : 'none';
        // Hidden under the overlays, so the panel's glass shows through them.
        head.style.visibility = blank || firstRead ? 'hidden' : '';
        body.style.visibility = blank || firstRead ? 'hidden' : '';

        const [from, to] = rangeOf(mode, cursor);
        // Only a move to another range fades in: a background refresh of the same range should not blink.
        const view = mode + '@' + +from;
        const navigated = view !== drawnView;
        drawnView = view;

        body.textContent = '';
        const occurrences = shownBetween(from, to);
        if (mode === 'month') month.draw(body, { start: from, month: cursor.getMonth(), occurrences });
        else timeGrid.draw(body, { days: daysOf(from, to), occurrences });
        if (navigated) fade(body, theme.motion.fast);

        const today = startOfDay(new Date()),
            tomorrow = addDays(today, 1);
        side.draw({
            today: shownBetween(today, tomorrow),
            upcoming: shownBetween(tomorrow, addDays(tomorrow, 14)).slice(0, 10),
        });
    }

    function statusText(loading) {
        const signedOut = accounts.all().filter((account) => reads.isSignedOut(account.id)).length;
        const broken = feeds.all().filter((feed) => reads.of(feed)?.error).length;
        const unprovided = accounts.all().filter((account) => !client.providerOf(account)).length;
        if (client.isSigningIn()) return 'Signing in…';
        if (loading) return 'Loading…';
        if (unprovided) return `${unprovided} account(s) wait for the mod that provides them`;
        if (signedOut) return `${signedOut} account(s) signed out`;
        if (broken) return `${broken} calendar(s) failed to load`;
        return reads.readAt() ? 'Updated ' + clockText(new Date(reads.readAt())) : '';
    }

    function showSpinner(running) {
        if (running === spinning) return;
        spinning = running;
        if (running) reloadButton.element.replaceChildren(ui.spinner({ size: 15 }).element);
        else reloadButton.setIcon(RELOAD);
    }

    function fade(element, length) {
        element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: length, easing: theme.motion.easing });
    }

    function shownBetween(from, to) {
        return reads.occurrences(
            feeds.all().filter((feed) => !feed.hidden),
            from,
            to
        );
    }

    function read(force = false) {
        reads.refresh(rangeOf(mode, cursor), force);
    }

    // Asked where the range moves and on the minute, not from render: render is put off while hidden, and the read
    // must not be.
    function follow() {
        reads.follow(rangeOf(mode, cursor));
    }

    function onRead() {
        render();
        reminders.check();
    }

    function shift(by) {
        if (mode === 'day') cursor = addDays(cursor, by);
        else if (mode === 'week') cursor = addDays(cursor, 7 * by);
        else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + by, 1);
        render();
        follow();
    }

    // Keeps the mode the person chose; only a click on a day number in the grid asks for the day.
    function goTo(date, next) {
        cursor = startOfDay(date);
        setMode(next || mode);
    }

    function showDate(date) {
        deck.show();
        goTo(date);
    }

    function setMode(next) {
        mode = next;
        values.set('mode', next);
        detail.close();
        render();
        follow();
    }

    async function answer(occurrence, status) {
        const account = accounts.all().find((candidate) => candidate.id === occurrence.account);
        if (!account) throw new Error('That account is gone');
        await client.respond(account, occurrence.id, status);
        reads.setRsvp(account.id, occurrence.id, status);
        render();
    }
}

// The days on screen, [from, to).
function rangeOf(mode, cursor) {
    if (mode === 'day') return [cursor, addDays(cursor, 1)];
    if (mode === 'week') return [startOfWeek(cursor), addDays(startOfWeek(cursor), 7)];
    const start = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    return [start, addDays(start, 42)];
}

function daysOf(from, to) {
    const days = [];
    for (let day = from; day < to; day = addDays(day, 1)) days.push(day);
    return days;
}

function titleOf(mode, cursor) {
    if (mode === 'day')
        return `${WEEKDAYS[cursor.getDay()]}, ${MONTHS[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
    if (mode === 'month') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const start = startOfWeek(cursor),
        end = addDays(start, 6);
    const left = `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()}`;
    const right =
        start.getMonth() === end.getMonth()
            ? `${end.getDate()}`
            : `${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}`;
    return `${left} – ${right}, ${end.getFullYear()}`;
}

module.exports = { calendar };
