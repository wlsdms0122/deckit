const { accountEditor } = require('../accounts/account-editor.js');
const { WEEKDAYS, MONTHS, addDays, startOfDay, startOfWeek, clockText } = require('../date/date.js');
const { eventDetail } = require('../event-detail/event-detail.js');
const { monthView } = require('../views/month-view.js');
const { paintPastNow } = require('../occurrence/paint.js');
const { sidebar } = require('../sidebar/sidebar.js');
const { switcher, inFront } = require('../switcher/switcher.js');
const { timeGridView } = require('../views/time-grid-view.js');
const { MODES } = require('./calendar.js');

// Calendar on screen: the view of `calendar` (calendar.js) at its mode and day, the sidebar, its keys, and what it adds
// to the switcher. `screen` is what `calendar` reaches it by; `end()` stops what it runs on its own.
function calendarView({ calendar, shell, deckit, sendTest }) {
    const { theme, ui } = shell;
    const { values } = deckit.storage;
    const { accounts, feeds, reads, client } = calendar;

    // Drawing waits while the pane is hidden or the popover is up: a redraw takes the popover's anchor away.
    let visible = false;
    let drawPending = false;
    let drawnView = '';
    let drawnDay = 0; // the day the view was drawn on, whose today it shows

    // A draw put off while the popover was up runs when it closes.
    const detail = eventDetail({
        ui,
        onAnswer: calendar.answer,
        onClose: () => {
            if (drawPending) setTimeout(render, 0);
        },
    });
    const editor = accountEditor({
        ui,
        accounts,
        feeds,
        reads,
        client,
        onChange: render,
        onRefresh: () => calendar.read(true),
    });
    const month = monthView({ ui, detail, onOpenDay: (day) => calendar.goTo(day, 'day') });
    const timeGrid = timeGridView({ detail });
    const side = sidebar({ ui, values, accounts, feeds, reads, client, editor, detail, onChange: render });
    const actions = switcher({
        ui,
        modes: MODES,
        reminders: calendar.reminders,
        occurrences: calendar.occurrencesBetween,
        show: shell.show,
        does: {
            ...inFront({
                'show-view': calendar.showView,
                'go-to-today': calendar.goToToday,
                'go-to-date': calendar.goToDate,
                previous: () => calendar.shift(-1),
                next: () => calendar.shift(1),
                'add-account': () => editor.addAccount(),
            }),
            'send-test': sendTest,
        },
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
        value: calendar.mode(),
        onChange: (key) => calendar.setMode(key),
    });
    const reloadButton = ui.iconButton({ icon: RELOAD, title: 'Refresh', onClick: () => calendar.read(true) });
    let spinning = false;
    head.append(
        ui.iconButton({
            icon: ui.icon('chevronLeft', { size: 17 }),
            title: 'Previous',
            onClick: () => calendar.shift(-1),
        }).element,
        ui.iconButton({ icon: ui.icon('chevronRight', { size: 17 }), title: 'Next', onClick: () => calendar.shift(1) })
            .element,
        title,
        status,
        reloadButton.element,
        ui.button({ label: 'Today', title: 'Jump to today', onClick: () => calendar.goTo(new Date()) }).element,
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

    const resizing = new ResizeObserver(() => {
        if (calendar.mode() === 'month' && !month.fitsAsDrawn()) render();
    });
    resizing.observe(body);

    // Being past changes with the clock alone, and so does the current-time line: each is moved in place, and only
    // a new day, which changes what today is, draws the view again.
    const ticking = setInterval(tick, 60 * 1000);

    return {
        content,
        sidebar: side.element,
        didAppear() {
            visible = true;
            calendar.read();
            render();
            calendar.follow();
        },
        didDisappear() {
            visible = false;
            detail.close();
        },
        keys: {
            today: { label: 'Go to Today', key: 'mod+t', run: calendar.goToToday },
            dayView: { label: 'Day view', key: 'mod+1', run: () => calendar.showView({ view: 'day' }) },
            weekView: { label: 'Week view', key: 'mod+2', run: () => calendar.showView({ view: 'week' }) },
            monthView: { label: 'Month view', key: 'mod+3', run: () => calendar.showView({ view: 'month' }) },
            previous: { label: 'Previous', key: 'mod+left', run: () => calendar.shift(-1) },
            next: { label: 'Next', key: 'mod+right', run: () => calendar.shift(1) },
        },
        actions,
        screen: {
            changed: render,
            moved() {
                detail.close();
                render();
            },
            reveal: shell.show,
            prompt,
        },
        end() {
            visible = false;
            clearInterval(ticking);
            resizing.disconnect();
        },
    };

    function tick() {
        if (!visible) return;
        if (+startOfDay(new Date()) !== drawnDay) return render();
        paintPastNow(body);
        paintPastNow(side.element);
        timeGrid.moveNowLine(body);
    }

    function render() {
        if (!visible || detail.isOpen()) {
            drawPending = true;
            return;
        }
        drawPending = false;
        const mode = calendar.mode(),
            cursor = calendar.cursor();
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
                ? 'Add an account, then choose which of its calendars to show.'
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

        const [from, to] = calendar.range();
        // Only a move to another range fades in, so a background refresh of the same range does not blink.
        const view = mode + '@' + +from;
        const navigated = view !== drawnView;
        drawnView = view;

        body.textContent = '';
        drawnDay = +startOfDay(new Date());
        const occurrences = calendar.shownBetween(from, to);
        if (mode === 'month') month.draw(body, { start: from, month: cursor.getMonth(), occurrences });
        else timeGrid.draw(body, { days: daysOf(from, to), occurrences });
        if (navigated) fade(body, theme.motion.fast);

        const today = startOfDay(new Date()),
            tomorrow = addDays(today, 1);
        side.draw({
            today: calendar.shownBetween(today, tomorrow),
            upcoming: calendar.shownBetween(tomorrow, addDays(tomorrow, 14)).slice(0, 10),
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

    // Calendar comes on screen and asks in a dialog: `{ answer, close }`, `answer` whether the person confirmed.
    function prompt({ title: heading, message, confirmLabel, cancelLabel }) {
        shell.show();
        let close = null;
        const answer = new Promise((resolve) => {
            let confirmed = false;
            close = ui.dialog({
                title: heading,
                message,
                confirmLabel,
                cancelLabel,
                onConfirm: () => (confirmed = true),
                // The dialog closes before it confirms.
                onClose: () => queueMicrotask(() => resolve(confirmed)),
            }).close;
        });
        return { answer, close };
    }
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

module.exports = { calendarView };
