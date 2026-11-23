const { accountEditor } = require('../accounts/account-editor.js');
const { WEEKDAYS, MONTHS, addDays, startOfDay, startOfWeek, clockText, dayOf } = require('../date/date.js');
const { eventDetail } = require('../event-detail/event-detail.js');
const { STYLE: ENTRY_STYLE, LANE_HEIGHT } = require('../views/bar.js');
const { monthView } = require('../views/month-view.js');
const { paintPastNow } = require('../occurrence/paint.js');
const { sidebar } = require('../sidebar/sidebar.js');
const { switcher, inFront } = require('../switcher/switcher.js');
const { timeGridView } = require('../views/time-grid-view.js');
const { viewKeys } = require('../keys/keys.js');

const MODES = [
    ['day', 'Day'],
    ['week', 'Week'],
    ['month', 'Month'],
];

// Calendar on screen: its window, the view of `calendar` (calendar.js) at its mode and day beside the sidebar, its own
// keys, and what it adds to the switcher. It tells `calendar` the days it shows by `follow(range)`, so they are read.
// `openWindow()` opens the window, or orders it front where it is open. `screen` is what `calendar` and the commands
// reach it by; `end()` stops what it runs on its own and closes the questions it asked.
function calendarView({ calendar, shell, deckit, sendTest }) {
    const { ui } = shell;
    const { values } = deckit.storage;
    const { accounts, feeds, reads, client } = calendar;
    ui.addStyle(ENTRY_STYLE);

    let mode = MODES.some(([key]) => key === values.get('mode', '')) ? values.get('mode') : 'month';
    let cursor = startOfDay(new Date());
    // The close() of each dialog prompt() has open.
    const asking = new Set();

    // Drawing waits while the window is off screen or the popover is up: a redraw takes the popover's anchor away.
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
    const month = monthView({ ui, detail, onOpenDay: (day) => goTo(day, 'day') });
    const timeGrid = timeGridView({ ui, detail });
    const side = sidebar({ ui, values, accounts, feeds, reads, client, editor, detail, onChange: render });
    const actions = switcher({
        ui,
        modes: MODES,
        reminders: calendar.reminders,
        occurrences: calendar.occurrencesBetween,
        show: openWindow,
        does: {
            ...inFront({
                'show-view': showView,
                'go-to-today': goToToday,
                'go-to-date': goToDate,
                previous: () => shift(-1),
                next: () => shift(1),
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
        font: 'var(--deckit-type-body)',
        position: 'relative',
        overflow: 'hidden',
    });

    const RELOAD = ui.icon('reload', { size: 16 });
    // Under this bar width the view switch is a pop-up button, so the title keeps its room.
    const NARROW = 560;
    // The status, beside Refresh, is what gives way where the bar is narrow.
    const status = document.createElement('span');
    Object.assign(status.style, {
        minWidth: '0',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--deckit-muted)',
        font: 'var(--deckit-type-small)',
    });
    const modeBar = ui.segmented({
        items: MODES.map(([key, label]) => ({ key, label, title: label + ' view' })),
        name: 'View',
        value: mode,
        onChange: (key) => setMode(key),
    });
    const modeSelect = ui.select({
        options: MODES.map(([value, label]) => ({ value, label })),
        label: 'View',
        value: mode,
        onChange: (key) => setMode(key),
    });
    const reloadButton = ui.iconButton({ icon: RELOAD, title: 'Refresh', onClick: () => calendar.read(true) });
    let spinning = false;
    const head = ui.titleBar({
        leading: [
            ui.iconButton({
                icon: ui.icon('chevronLeft', { size: 16 }),
                title: 'Previous',
                onClick: () => shift(-1),
            }).element,
            ui.iconButton({ icon: ui.icon('chevronRight', { size: 16 }), title: 'Next', onClick: () => shift(1) })
                .element,
        ],
        trailing: [
            status,
            reloadButton.element,
            ui.button({ label: 'Today', title: 'Jump to today', onClick: () => goTo(new Date()) }).element,
            modeBar.element,
            modeSelect.element,
        ],
    });
    modeSelect.element.style.display = 'none';
    new ResizeObserver(() => {
        const narrow = head.element.clientWidth < NARROW;
        modeBar.element.style.display = narrow ? 'none' : '';
        modeSelect.element.style.display = narrow ? '' : 'none';
    }).observe(head.element);

    const body = document.createElement('div');
    Object.assign(body.style, {
        flex: '1 1 auto',
        minHeight: '0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    });

    const emptyAction = ui.button({
        label: 'Add Account…',
        size: 'small',
        variant: 'primary',
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

    // The first read, from when it starts until it has settled: `chips`, a skeleton chip for each day of the month.
    let firstLoad = null;

    // Calendars that could not be read, above the view, with a retry. Drawn anew only when what it says changes.
    const failure = ui.notice({});
    let failureSaid = '';
    Object.assign(failure.element.style, { display: 'none', flex: '0 0 auto', margin: '16px 16px 8px' });

    content.append(head.element, failure.element, body, empty);

    // The body's size is observed in the window it is shown in, from each time it appears.
    let resizing = null;
    const fit = () => {
        if (mode === 'month' && !month.fitsAsDrawn()) render();
    };

    // Being past changes with the clock alone, and so does the current-time line: each is moved in place, and only
    // a new day, which changes what today is, draws the view again.
    const ticking = setInterval(tick, 60 * 1000);

    calendar.follow(rangeOf(mode, cursor));

    // The window's own keys, while it is key.
    const keys = viewKeys(
        {
            today: { key: 'mod+t', run: goToToday },
            dayView: { key: 'mod+1', run: () => showView({ view: 'day' }) },
            weekView: { key: 'mod+2', run: () => showView({ view: 'week' }) },
            monthView: { key: 'mod+3', run: () => showView({ view: 'month' }) },
            // In a field ⌘← and ⌘→ move the caret.
            previous: { key: 'mod+left', run: () => shift(-1), fieldsKeep: true },
            next: { key: 'mod+right', run: () => shift(1), fieldsKeep: true },
        },
        { log: 'calendar', within: content }
    );

    // The days beside the sidebar, whose width and fold are kept as the person leaves them.
    const split = ui.splitView({
        sidebar: side.element,
        content,
        ...values.get('sidebar', {}),
        onChange: (kept) => values.set('sidebar', kept),
    });

    return {
        openWindow,
        actions,
        screen: {
            changed: render,
            openWindow,
            goToDate,
            showView,
            prompt,
        },
        // A sign-in waiting on a question closed here hears `false`, as when the person closes it.
        end() {
            visible = false;
            keys.listen(false);
            clearInterval(ticking);
            resizing?.disconnect();
            for (const close of [...asking]) close();
            calendar.follow(null);
        },
    };

    function openWindow() {
        shell.windows.open({
            name: 'main',
            titleBar: 'unified',
            content: split.element,
            didAppear() {
                visible = true;
                resizing?.disconnect();
                resizing = new body.ownerDocument.defaultView.ResizeObserver(fit);
                resizing.observe(body);
                calendar.read();
                render();
                calendar.follow(rangeOf(mode, cursor));
            },
            didBecomeKey: () => keys.listen(true),
            didResignKey: () => keys.listen(false),
            didDisappear() {
                visible = false;
                detail.close();
            },
        });
    }

    function shift(by) {
        if (mode === 'day') cursor = addDays(cursor, by);
        else if (mode === 'week') cursor = addDays(cursor, 7 * by);
        else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + by, 1);
        render();
        calendar.follow(rangeOf(mode, cursor));
    }

    function goToToday() {
        goTo(new Date());
    }

    function goToDate({ date }) {
        const day = dayOf(date);
        if (!day) throw new Error(`${date} is not a day written as YYYY-MM-DD`);
        goTo(day);
    }

    function showView({ view }) {
        if (!MODES.some(([key]) => key === view)) throw new Error(`Calendar has no ${view} view`);
        setMode(view);
    }

    // Keeps the mode the person chose; only a click on a day number in the grid asks for the day.
    function goTo(date, next) {
        cursor = startOfDay(date);
        setMode(next || mode);
    }

    function setMode(next) {
        mode = next;
        values.set('mode', next);
        detail.close();
        render();
        calendar.follow(rangeOf(mode, cursor));
    }

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
        const loading = reads.isLoading();
        head.set({ title: titleOf(mode, cursor) });
        modeBar.set(mode);
        modeSelect.set(mode);
        showSpinner(loading);
        status.textContent = statusText(loading);
        showFailure();

        const noAccount = !accounts.all().length,
            blank = !feeds.all().length;
        emptyState.set({
            title: noAccount ? 'No accounts yet' : 'No calendars shown',
            hint: noAccount
                ? 'Add an account, then choose which of its calendars to show.'
                : 'Choose which calendars of your account to show.',
        });
        emptyAction.setLabel(noAccount ? 'Add Account…' : 'Choose Calendars…');
        if (empty.style.display !== (blank ? 'flex' : 'none')) {
            empty.style.display = blank ? 'flex' : 'none';
            if (blank) ui.motion.appear(empty);
        }
        const firstRead = !blank && loading && feeds.all().every((feed) => !reads.has(feed));
        showFirstLoad(firstRead, blank);
        // Hidden under the empty state, so the window's background material shows through it.
        head.element.style.visibility = blank ? 'hidden' : '';
        body.style.visibility = blank ? 'hidden' : '';

        const [from, to] = rangeOf(mode, cursor);
        // Only a move to another range fades in, so a background refresh of the same range does not blink; one a key made
        // is drawn at once.
        const view = mode + '@' + +from;
        const navigated = view !== drawnView;
        drawnView = view;

        body.textContent = '';
        drawnDay = +startOfDay(new Date());
        const occurrences = firstLoad ? [] : calendar.shownBetween(from, to);
        const placeholders = firstLoad?.chips;
        if (mode === 'month') month.draw(body, { start: from, month: cursor.getMonth(), occurrences, placeholders });
        else timeGrid.draw(body, { days: daysOf(from, to), occurrences });
        if (navigated && !ui.motion.keyed()) ui.motion.appear(body);

        const today = startOfDay(new Date()),
            tomorrow = addDays(today, 1);
        side.draw({
            today: calendar.shownBetween(today, tomorrow),
            upcoming: calendar.shownBetween(tomorrow, addDays(tomorrow, 14)).slice(0, 10),
        });
    }

    // The view shows no events while the first read lasts, the month view skeleton chips in its days, made once so they
    // keep their wait across draws. Chips shown stay their least before the events take their place, so they do not
    // flash; with nothing to show they go at once.
    function showFirstLoad(reading, blank) {
        if (reading && !firstLoad)
            firstLoad = {
                chips: Array.from({ length: 42 }, () => ui.loading.skeleton({ rows: 1, height: LANE_HEIGHT })),
            };
        if (reading || !firstLoad) return;
        const going = firstLoad;
        const drop = () => {
            if (firstLoad === going) firstLoad = null;
        };
        if (blank) return drop();
        if (going.going) return;
        going.going = true;
        going.chips[0].settled().then(() => {
            drop();
            render();
        });
    }

    function showFailure() {
        // An account waiting for its provider is said in the status, not as a calendar's failure.
        const provided = (feed) => {
            const account = accounts.all().find((each) => each.id === feed.account);
            return account && client.providerOf(account);
        };
        const broken = feeds.all().filter((feed) => reads.of(feed)?.error && provided(feed));
        const nameOf = (feed) => feed.label || feed.calendar;
        const said = broken.map((feed) => `${nameOf(feed)}: ${reads.of(feed).error}`).join('\n');
        failure.element.style.display = said ? '' : 'none';
        if (!said || said === failureSaid) return;
        failureSaid = said;
        failure.set({
            text:
                broken.length === 1
                    ? `${nameOf(broken[0])} could not be read.`
                    : `${broken.length} calendars could not be read.`,
            details: said,
            action: { label: 'Try Again', run: () => calendar.read(true) },
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
        if (running) reloadButton.element.replaceChildren(ui.spinner({ size: 16 }).element);
        else reloadButton.setIcon(RELOAD);
    }

    // Calendar's window comes on screen and asks in a dialog: `{ answer, close }`, `answer` whether the person
    // confirmed.
    function prompt({ title: heading, message, confirmLabel, cancelLabel }) {
        openWindow();
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
                onClose: () => {
                    asking.delete(close);
                    queueMicrotask(() => resolve(confirmed));
                },
            }).close;
        });
        asking.add(close);
        return { answer, close };
    }
}

// The days the view shows at `mode` and `cursor`, [from, to).
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

module.exports = { calendarView };
