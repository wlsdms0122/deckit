/* An account is a provider's: a mod that extends the `accounts` point (README.md) signs it in, keeps
 * what it signed in with, and reads its calendars. The calendar keeps which accounts there are and
 * which of their calendars are shown, by the provider's mod id.
 */
const { trimUrl } = require('./event.js');

// Minutes before a meeting it is announced; 0 is at the start.
const REMINDER_LEADS = [0, 1, 5, 10, 15, 30];
const DEFAULT_LEAD = 10;
const leadText = (lead) => (lead === null ? 'Off' : lead === 0 ? 'At start time' : `${lead} min before`);

const calendar = (deck, accountsPoint) => {
    const { theme, ui, settings } = deck;
    const { values, records } = deck.storage;
    // A failed write is shown on this mod's row in Settings.
    const keep = (key, value) => records.set(key, value).catch(() => {});
    const ease = (length) => `${length}ms ${theme.motion.easing}`;
    const fade = (element, length) =>
        element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: length, easing: theme.motion.easing });
    const REFRESH_INTERVAL = 10 * 60 * 1000;
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
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
    const MONTHS = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ];
    const DAY_MS = 86400000;
    const LANE_HEIGHT = 19;
    const HOUR_HEIGHT = 44;
    const GUTTER_WIDTH = '52px';
    const NO_TITLE = '(no title)';
    const nameOf = (occurrence) => occurrence.summary || NO_TITLE;

    /* ================= accounts and calendars ================= */

    // By the id of the mod that provides them. One whose mod is not running keeps its account, unread.
    const providers = () => accountsPoint.extensions();
    const providerOf = (account) => providers()[account.provider] || null;
    // A provider says an account has to be signed in again by the kind of the error it throws.
    const SIGN_IN = 'SIGN_IN';
    const asksToSignIn = (error) => error?.kind === SIGN_IN;
    // How long a provider may take to answer a read before it counts as failed, so one that never answers does not
    // hold every account's refresh.
    const ANSWER_LIMIT_MS = 60 * 1000;
    const withinLimit = (provider, asking) => {
        let timer = null;
        const limit = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${provider.name} did not answer`)), ANSWER_LIMIT_MS);
        });
        return Promise.race([asking, limit]).finally(() => clearTimeout(timer));
    };
    // What a provider keeps for an account goes with it; one that keeps nothing has no forget(). Removed while its
    // provider is not running, the account waits for it in FORGOTTEN.
    const FORGOTTEN = 'forgotten';
    const forget = (provider, account) => Promise.resolve(provider.forget?.(account)).catch(() => {});
    const forgetWaiting = () => {
        const waiting = records.get(FORGOTTEN, []);
        const left = waiting.filter((account) => !providerOf(account));
        if (left.length === waiting.length) return;
        for (const account of waiting) if (providerOf(account)) forget(providerOf(account), account);
        keep(FORGOTTEN, left);
    };
    // Occurrences as the cache and providers give them, in the shape the rest reads (README.md): one without an id or
    // a date is left out.
    const occurrencesOf = (events) =>
        events
            .filter((event) => event && typeof event === 'object' && event.id != null)
            .map((event) => ({
                id: String(event.id),
                uid: String(event.uid ?? event.id),
                summary: String(event.summary ?? ''),
                start: new Date(event.start),
                end: new Date(event.end),
                allDay: !!event.allDay,
                call:
                    event.call && typeof event.call.url === 'string'
                        ? { name: String(event.call.name ?? ''), url: event.call.url }
                        : null,
                rooms: Array.isArray(event.rooms) ? event.rooms.map(String) : [],
                location: String(event.location ?? ''),
                description: String(event.description ?? ''),
                rsvp: typeof event.rsvp === 'string' ? event.rsvp : '',
                invited: !!event.invited,
            }))
            .filter((event) => !isNaN(event.start) && !isNaN(event.end));

    // Records rather than values, so a reset profile keeps them.
    const accounts = () => records.get('accounts', []).filter((account) => account && account.id && account.provider);
    const saveAccounts = (list) => keep('accounts', list);
    const keyOf = (feed) => feed.account + '/' + feed.calendar;
    const feeds = () => {
        const ids = new Set(accounts().map((account) => account.id));
        return records
            .get('feeds', [])
            .filter((feed) => feed && ids.has(feed.account) && typeof feed.calendar === 'string');
    };
    const saveFeeds = (list) => keep('feeds', list);
    // A feed without remindAll reminds for everything only when it is the account's own calendar.
    const remindsAll = (feed) =>
        feed.remindAll ??
        accounts().some(
            (account) => account.id === feed.account && account.email.toLowerCase() === feed.calendar.toLowerCase()
        );

    /* What has been read, by calendar: { now, view, error, signIn, failedAt }. A failed read keeps
     what was read before it. `now` is cached across launches, because the first read after a
     launch often fails and the sidebar and the reminders stand on it; `view` is not. */
    const reads = (() => {
        const CACHE_KEY = 'cache';
        const record = new Map();
        // The cache is a file, so a window that is not one is not read.
        const revive = (readWindow) =>
            Array.isArray(readWindow?.events)
                ? { from: readWindow.from, to: readWindow.to, events: occurrencesOf(readWindow.events) }
                : null;
        for (const [key, readWindow] of Object.entries(records.get(CACHE_KEY, {}))) {
            if (feeds().some((feed) => keyOf(feed) === key))
                record.set(key, { now: revive(readWindow), view: null, error: null, failedAt: 0 });
        }
        // Written whole, so a calendar turned off or removed drops out.
        const save = () => {
            const out = {};
            for (const feed of feeds()) {
                const now = record.get(keyOf(feed))?.now;
                if (now) out[keyOf(feed)] = now;
            }
            keep(CACHE_KEY, out);
        };
        return {
            of: (feed) => record.get(keyOf(feed)),
            has: (feed) => record.has(keyOf(feed)),
            keep(feed, now, view) {
                record.set(keyOf(feed), { now, view, error: null, failedAt: 0 });
            },
            fail(feed, error) {
                const before = record.get(keyOf(feed)) || { now: null, view: null };
                record.set(keyOf(feed), {
                    now: before.now,
                    view: before.view,
                    error: String(error.message || error),
                    signIn: asksToSignIn(error),
                    failedAt: Date.now(),
                });
            },
            dropFeed(key) {
                record.delete(key);
                save();
            },
            dropAccount(id) {
                for (const key of [...record.keys()]) if (key.startsWith(id + '/')) record.delete(key);
                save();
            },
            // Into both windows of every calendar of the account, until the next read says the same.
            setRsvp(accountId, eventId, status) {
                for (const feed of feeds()) {
                    if (feed.account !== accountId) continue;
                    const entry = record.get(keyOf(feed));
                    for (const readWindow of [entry?.now, entry?.view]) {
                        for (const event of readWindow?.events || []) if (event.id === eventId) event.rsvp = status;
                    }
                }
                save();
            },
            save,
        };
    })();
    const accountStatus = new Map(); // account id -> { loading, signedOut }
    const statusOf = (id) => {
        if (!accountStatus.has(id)) accountStatus.set(id, { loading: false, signedOut: false });
        return accountStatus.get(id);
    };
    let fetchedAt = 0,
        loading = false;
    // Drawing waits while the pane is hidden or the popover is up: a redraw takes the popover's anchor away.
    let visible = false,
        drawPending = false;

    const respond = async (occurrence, status) => {
        const account = accounts().find((candidate) => candidate.id === occurrence.account);
        if (!account) throw new Error('That account is gone');
        const provider = providerOf(account);
        if (!provider) throw new Error(`${account.provider} is not running`);
        await provider.respond(account, occurrence.id, status);
        reads.setRsvp(account.id, occurrence.id, status);
        render();
    };

    /* Two windows, because the API answers with occurrences rather than rules: `now` is today and the
     fortnight the sidebar and the reminders need, always read; `view` is the screen with a margin,
     read only when `now` does not reach it. */
    const NOW_BEFORE = DAY_MS,
        NOW_AFTER = 17 * DAY_MS;
    const VIEW_MARGIN = 35 * DAY_MS;
    const RETRY_MS = 60 * 1000;
    const nowWindow = () => {
        const today = +startOfDay(new Date());
        return [today - NOW_BEFORE, today + NOW_AFTER];
    };
    const within = (readWindow, [from, to]) => !!readWindow && readWindow.from <= from && readWindow.to >= to;
    const viewWindow = () => {
        const [from, to] = rangeOf().map(Number);
        if (within({ from: nowWindow()[0], to: nowWindow()[1] }, [from, to])) return null;
        return [from - VIEW_MARGIN, to + VIEW_MARGIN];
    };
    const covers = (entry) => {
        if (!entry) return false;
        // Signed out waits for a sign-in; any other failure is read again after RETRY_MS.
        if (entry.error && (entry.signIn || Date.now() - entry.failedAt < RETRY_MS)) return true;
        const screen = rangeOf().map(Number);
        return within(entry.now, nowWindow()) && (within(entry.now, screen) || within(entry.view, screen));
    };
    const eventsOf = (entry) => {
        if (!entry) return [];
        if (!entry.view) return entry.now?.events || [];
        const seen = new Set();
        return [...(entry.now?.events || []), ...entry.view.events].filter(
            (event) => !seen.has(event.id) && seen.add(event.id)
        );
    };

    // An account whose provider is not running is not read: what was read stays until it is.
    const loadAccount = async (account, list) => {
        const state = statusOf(account.id);
        const provider = providerOf(account);
        if (!provider) return;
        const nowRange = nowWindow(),
            viewRange = viewWindow();
        state.signedOut = false;
        const read = async (feed, [from, to]) => {
            const events = await withinLimit(
                provider,
                provider.events(account, feed.calendar, new Date(from), new Date(to))
            );
            if (!Array.isArray(events)) throw new Error(`${provider.name} answered no list of events`);
            return { from, to, events: occurrencesOf(events) };
        };
        await Promise.all(
            list.map(async (feed) => {
                try {
                    const [now, view] = await Promise.all([
                        read(feed, nowRange),
                        viewRange ? read(feed, viewRange) : null,
                    ]);
                    reads.keep(feed, now, view);
                } catch (error) {
                    if (asksToSignIn(error)) state.signedOut = true;
                    reads.fail(feed, error);
                }
            })
        );
    };

    // A forced read asked for while one runs is run after it: the running one was asked before the change.
    let again = false;
    const refresh = async (force = false) => {
        const list = feeds();
        if (!list.length) {
            fetchedAt = Date.now();
            render();
            return;
        }
        if (loading) {
            if (force) again = true;
            return;
        }
        const failing = list.some((feed) => {
            const entry = reads.of(feed);
            return entry?.error && !entry.signIn;
        });
        if (!force && Date.now() - fetchedAt < (failing ? RETRY_MS : REFRESH_INTERVAL)) return;
        loading = true;
        try {
            for (const account of accounts())
                statusOf(account.id).loading = list.some((feed) => feed.account === account.id);
            render();
            await Promise.all(
                accounts().map((account) =>
                    loadAccount(
                        account,
                        list.filter((feed) => feed.account === account.id)
                    )
                )
            );
            fetchedAt = Date.now();
            reads.save();
        } finally {
            loading = false;
            for (const account of accounts()) statusOf(account.id).loading = false;
        }
        render();
        notifyDue();
        if (again) {
            again = false;
            refresh(true);
        }
    };

    const updateFeed = (key, patch) => {
        if (!feeds().some((feed) => keyOf(feed) === key)) return;
        saveFeeds(feeds().map((feed) => (keyOf(feed) === key ? { ...feed, ...patch } : feed)));
        render();
    };

    const removeFeed = (key) => {
        saveFeeds(feeds().filter((feed) => keyOf(feed) !== key));
        reads.dropFeed(key);
        render();
    };

    const visibleOccurrences = (from, to) => {
        const out = [];
        for (const feed of feeds()) {
            if (feed.hidden) continue;
            const entry = reads.of(feed);
            if (!entry) continue;
            for (const occurrence of eventsOf(entry)) {
                if (+occurrence.end > +from && +occurrence.start < +to) {
                    out.push({ ...occurrence, color: feed.color, account: feed.account, remindAll: remindsAll(feed) });
                }
            }
        }
        // Date first: all-day before timed holds only within one day.
        return out.sort(
            (first, second) =>
                startOfDay(first.start) - startOfDay(second.start) ||
                second.allDay - first.allDay ||
                first.start - second.start
        );
    };

    /* ================= dates ================= */

    const startOfDay = (date) => {
        const day = new Date(date);
        day.setHours(0, 0, 0, 0);
        return day;
    };
    const addDays = (date, count) => {
        const day = new Date(date);
        day.setDate(day.getDate() + count);
        return day;
    };
    const startOfWeek = (date) => addDays(startOfDay(date), -startOfDay(date).getDay());
    const sameDay = (first, second) =>
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate();
    const clockText = (date) =>
        String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    // A difference in calendar days, so rounding absorbs daylight saving.
    const dayDelta = (later, earlier) => Math.round((+startOfDay(later) - +startOfDay(earlier)) / DAY_MS);
    // All-day, or a day or longer: drawn as a bar.
    const isSpanning = (occurrence) => occurrence.allDay || +occurrence.end - +occurrence.start >= DAY_MS;

    /* ================= view state ================= */

    const MODES = [
        ['day', 'Day'],
        ['week', 'Week'],
        ['month', 'Month'],
    ];
    let mode = MODES.some(([key]) => key === values.get('mode', '')) ? values.get('mode') : 'month';
    let cursor = startOfDay(new Date());
    let lastCapacity = 0,
        lastViewKey = '';
    // The grid is rebuilt on every render, so its scroll offset is carried here. It opens on the working day.
    let hourScroll = 7.5 * HOUR_HEIGHT;

    const rangeOf = () => {
        if (mode === 'day') return [cursor, addDays(cursor, 1)];
        if (mode === 'week') return [startOfWeek(cursor), addDays(startOfWeek(cursor), 7)];
        const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const start = startOfWeek(first);
        return [start, addDays(start, 42)];
    };

    const titleOf = () => {
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
    };

    const shift = (by) => {
        if (mode === 'day') cursor = addDays(cursor, by);
        else if (mode === 'week') cursor = addDays(cursor, 7 * by);
        else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + by, 1);
        render();
        follow();
    };

    // Keeps the mode the person chose; only a click on a day number in the grid asks for the day.
    const goTo = (date, next) => {
        cursor = startOfDay(date);
        setMode(next || mode);
    };

    // How far ahead the next meeting is still news: the rest of a working day, not tomorrow.
    const NOW_HORIZON_MS = 6 * 3600000;

    // Under a minute says so, since "in 0 min" is a rounding artefact.
    const untilText = (when, from) => {
        const minutes = Math.round((+when - +from) / 60000);
        if (minutes < 1) return 'in under a minute';
        if (minutes < 60) return `in ${minutes} min`;
        const hours = Math.floor(minutes / 60),
            rest = minutes % 60;
        return rest ? `in ${hours}h ${rest}m` : `in ${hours}h`;
    };

    const setMode = (next) => {
        mode = next;
        values.set('mode', next);
        closeDetail();
        render();
        follow();
    };

    /* ================= content ================= */

    // Its ground is in a rule rather than inline, where it would stand over the kit's pressable wash.
    const PLAIN_BUTTON = 'calendar-plain-button';
    ui.addStyle(`.${PLAIN_BUTTON} { border: 0; background: transparent; cursor: pointer; }`);

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

    const CHEVRON_LEFT = ui.icon('chevronLeft', { size: 17 });
    const CHEVRON_RIGHT = ui.icon('chevronRight', { size: 17 });
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

    const reloadButton = ui.iconButton({ icon: RELOAD, title: 'Refresh', onClick: () => refresh(true) });
    let spinning = false;
    const showSpinner = (running) => {
        if (running === spinning) return;
        spinning = running;
        if (running) reloadButton.element.replaceChildren(ui.spinner({ size: 15 }).element);
        else reloadButton.setIcon(RELOAD);
    };

    head.append(
        ui.iconButton({ icon: CHEVRON_LEFT, title: 'Previous', onClick: () => shift(-1) }).element,
        ui.iconButton({ icon: CHEVRON_RIGHT, title: 'Next', onClick: () => shift(1) }).element,
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

    /* ================= event detail ================= */

    // The kit's popover, so Escape closes it before the panel. A draw put off while it was up runs when it closes.
    const detail = ui.popover({
        onClose: () => {
            if (drawPending) setTimeout(render, 0);
        },
    });
    const closeDetail = () => detail.close();

    const linkify = (text) => {
        const box = document.createElement('div');
        const pattern = /https?:\/\/[^\s<>"]+/g;
        let last = 0,
            match;
        while ((match = pattern.exec(text))) {
            if (match.index > last) box.appendChild(document.createTextNode(text.slice(last, match.index)));
            const url = trimUrl(match[0]);
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noreferrer';
            link.textContent = url.length > 48 ? url.slice(0, 48) + '…' : url;
            Object.assign(link.style, { color: 'var(--deckit-accent)', wordBreak: 'break-all' });
            box.appendChild(link);
            last = match.index + url.length;
            pattern.lastIndex = last;
        }
        if (last < text.length) box.appendChild(document.createTextNode(text.slice(last)));
        ui.selectable(box);
        return box;
    };

    const detailLine = (iconName, value) => {
        const line = document.createElement('div');
        Object.assign(line.style, { display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '6px' });
        const icon = document.createElement('span');
        icon.innerHTML = ui.icon(iconName, { size: 14 });
        Object.assign(icon.style, { flex: '0 0 auto', marginTop: '2px', opacity: '.6' });
        if (typeof value === 'string') {
            const text = document.createElement('span');
            text.textContent = value;
            value = text;
        }
        value.style.minWidth = '0';
        value.style.wordBreak = 'break-word';
        line.append(icon, value);
        return line;
    };

    const showDetail = (occurrence, anchor) => {
        detail.element.textContent = '';
        const name = document.createElement('div');
        name.textContent = nameOf(occurrence);
        Object.assign(name.style, { font: '700 14.5px var(--deckit-font)', marginBottom: '4px' });
        const when = document.createElement('div');
        when.textContent = occurrence.allDay
            ? dayDelta(new Date(+occurrence.end - 1), occurrence.start) > 0
                ? `All day · ${occurrence.start.toDateString()} – ${new Date(+occurrence.end - 1).toDateString()}`
                : 'All day · ' + occurrence.start.toDateString()
            : `${occurrence.start.toDateString()} · ${clockText(occurrence.start)}–${clockText(occurrence.end)}`;
        when.style.opacity = '.65';
        detail.element.append(name, when);

        // An answer that cannot be changed here is said, unless it is the plain "going".
        if (!occurrence.invited && RSVP_LABEL[occurrence.rsvp] && occurrence.rsvp !== 'ACCEPTED') {
            const badge = document.createElement('span');
            badge.textContent = RSVP_LABEL[occurrence.rsvp];
            Object.assign(badge.style, {
                display: 'inline-block',
                marginTop: '6px',
                padding: '1px 8px',
                borderRadius: '10px',
                font: '11.5px var(--deckit-font)',
                border: '1px solid ' + occurrence.color,
                color: occurrence.color,
            });
            detail.element.appendChild(badge);
        }

        if (occurrence.call) {
            const join = document.createElement('a');
            join.href = occurrence.call.url;
            join.target = '_blank';
            join.rel = 'noreferrer';
            join.textContent = 'Join ' + occurrence.call.name;
            join.title = occurrence.call.url;
            Object.assign(join.style, {
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: '7px',
                background: 'var(--deckit-accent)',
                color: '#fff',
                textDecoration: 'none',
                font: '600 12.5px var(--deckit-font)',
            });
            detail.element.appendChild(detailLine('video', join));
        }
        if (occurrence.rooms?.length) detail.element.appendChild(detailLine('door', occurrence.rooms.join(', ')));
        if (occurrence.location) detail.element.appendChild(detailLine('mapPin', linkify(occurrence.location)));

        if (occurrence.description) {
            const box = linkify(occurrence.description.slice(0, 1200));
            Object.assign(box.style, {
                opacity: '.8',
                whiteSpace: 'pre-wrap',
                maxHeight: '180px',
                overflowY: 'auto',
                marginTop: '10px',
            });
            detail.element.appendChild(box);
        }

        if (occurrence.invited) {
            const foot = rsvpBar(occurrence);
            Object.assign(foot.style, {
                margin: '12px -14px -12px',
                padding: '10px 14px',
                borderTop: 'var(--deckit-border)',
            });
            detail.element.appendChild(foot);
        }
        detail.show(anchor);
    };

    // A month cell's overflow: everything that day, in one list.
    const showDayList = (day, occurrences, anchor) => {
        detail.element.textContent = '';
        const name = document.createElement('div');
        name.textContent = `${MONTHS[day.getMonth()]} ${day.getDate()}`;
        Object.assign(name.style, { font: '700 14.5px var(--deckit-font)', marginBottom: '8px' });
        detail.element.appendChild(name);
        for (const occurrence of occurrences) {
            const line = document.createElement('div');
            Object.assign(line.style, {
                display: 'flex',
                alignItems: 'baseline',
                gap: '7px',
                padding: '3px 0',
                cursor: 'pointer',
            });
            const dot = document.createElement('span');
            Object.assign(dot.style, {
                flex: '0 0 auto',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: occurrence.color,
            });
            const time = document.createElement('span');
            time.textContent = isSpanning(occurrence) ? 'All day' : clockText(occurrence.start);
            Object.assign(time.style, {
                flex: '0 0 auto',
                minWidth: '50px',
                opacity: '.55',
                font: '12px var(--deckit-font)',
            });
            paintDot(dot, occurrence);
            const text = document.createElement('span');
            text.textContent = nameOf(occurrence);
            paintText(text, occurrence);
            line.append(dot, time, text);
            paintPast(line, occurrence);
            line.addEventListener('click', (event) => {
                event.stopPropagation();
                showDetail(occurrence, anchor);
            });
            detail.element.appendChild(line);
        }
        detail.show(anchor);
    };

    /* ================= RSVP ================= */

    const RSVP_LABEL = { ACCEPTED: 'Going', DECLINED: 'Declined', TENTATIVE: 'Maybe', 'NEEDS-ACTION': 'No response' };

    const RSVP_CHOICES = [
        ['ACCEPTED', 'Yes'],
        ['TENTATIVE', 'Maybe'],
        ['DECLINED', 'No'],
    ];
    const rsvpBar = (occurrence) => {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, { marginBottom: '8px' });
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px' });
        const ask = document.createElement('span');
        ask.textContent = 'Going?';
        Object.assign(ask.style, { opacity: '.65', font: '12.5px var(--deckit-font)' });
        const note = document.createElement('div');
        Object.assign(note.style, {
            display: 'none',
            marginTop: '6px',
            color: 'var(--deckit-alert)',
            font: '12px var(--deckit-font)',
        });
        let answering = false;
        const answers = ui.segmented({
            items: RSVP_CHOICES.map(([answer, label]) => ({ key: answer, label })),
            value: occurrence.rsvp,
            size: 'small',
            accent: occurrence.color,
            onChange: async (answer) => {
                // A press while an answer is on its way is dropped.
                if (answering) return;
                answering = true;
                note.style.display = 'none';
                busy.style.display = 'inline-block';
                const before = occurrence.rsvp;
                occurrence.rsvp = answer;
                answers.set(answer);
                try {
                    await respond(occurrence, answer);
                } catch (error) {
                    occurrence.rsvp = before;
                    answers.set(before);
                    note.textContent = String(error.message || error);
                    note.style.display = 'block';
                }
                answering = false;
                busy.style.display = 'none';
            },
        });
        const busy = ui.spinner({ size: 12 }).element;
        busy.style.display = 'none';
        row.append(ask, answers.element, busy);
        wrap.append(row, note);
        return wrap;
    };

    const isPast = (occurrence) => +occurrence.end <= Date.now();

    // Applied to the whole entry, so the strike crosses the time and the title as one line.
    const paintPast = (element, occurrence) => {
        if (!isPast(occurrence)) return;
        // Multiplied: declined and tentative have dimmed themselves already, and past ones read fainter still.
        element.style.opacity = String(((parseFloat(element.style.opacity) || 1) * 0.55).toFixed(2));
        element.style.textDecoration = 'line-through';
    };

    // A filled bar or box: declined is struck out, an unanswered invite is hollow.
    const paintSolid = (element, occurrence) => {
        if (occurrence.rsvp === 'DECLINED') {
            element.style.background = occurrence.color;
            element.style.opacity = '.4';
            element.style.textDecoration = 'line-through';
        } else if (occurrence.rsvp === 'NEEDS-ACTION') {
            element.style.background = 'transparent';
            element.style.border = '1.5px solid ' + occurrence.color;
            element.style.color = occurrence.color;
        } else if (occurrence.rsvp === 'TENTATIVE') {
            element.style.background = occurrence.color;
            element.style.opacity = '.62';
        }
    };

    const paintDot = (dot, occurrence) => {
        if (occurrence.rsvp === 'NEEDS-ACTION') {
            dot.style.background = 'transparent';
            dot.style.border = '1.5px solid ' + occurrence.color;
            dot.style.boxSizing = 'border-box';
        } else if (occurrence.rsvp === 'TENTATIVE') {
            dot.style.opacity = '.55';
        }
    };

    const paintText = (element, occurrence) => {
        if (occurrence.rsvp === 'DECLINED') {
            element.style.textDecoration = 'line-through';
            element.style.opacity = '.5';
        }
    };

    /* ================= bars ================= */

    // Greedy lane packing, so a multi-day event stays one block across the row.
    const assignLanes = (items) => {
        items.sort((first, second) => second.span - first.span || first.occurrence.start - second.occurrence.start);
        const lanes = [];
        for (const item of items) {
            let index = lanes.findIndex((lane) =>
                lane.every(
                    (placed) => item.column >= placed.column + placed.span || item.column + item.span <= placed.column
                )
            );
            if (index < 0) {
                lanes.push([]);
                index = lanes.length - 1;
            }
            lanes[index].push(item);
            item.lane = index;
        }
        return lanes.length;
    };

    // Places occurrences on the columns of a row of `count` days starting at `start`.
    const rowItems = (start, count, occurrences) =>
        occurrences
            .map((occurrence) => {
                const column = Math.max(0, dayDelta(occurrence.start, start));
                const lastDay = dayDelta(new Date(+occurrence.end - 1), start);
                const span = Math.min(count, lastDay + 1) - column;
                return span > 0 ? { occurrence, column, span } : null;
            })
            .filter(Boolean);

    const bar = (occurrence, continuous) => {
        const element = document.createElement('div');
        Object.assign(element.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            height: LANE_HEIGHT - 3 + 'px',
            margin: '0 2px',
            padding: '0 5px',
            borderRadius: '4px',
            boxSizing: 'border-box',
            font: '12px var(--deckit-font)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            background: continuous ? occurrence.color : 'transparent',
            color: continuous ? '#fff' : 'inherit',
            transition: `background-color ${ease(theme.motion.fast)}, filter ${ease(theme.motion.fast)}`,
        });
        if (continuous) {
            paintSolid(element, occurrence);
        } else {
            const dot = document.createElement('span');
            Object.assign(dot.style, {
                flex: '0 0 auto',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: occurrence.color,
            });
            paintDot(dot, occurrence);
            const time = document.createElement('span');
            time.textContent = clockText(occurrence.start);
            Object.assign(time.style, { flex: '0 0 auto', opacity: '.6' });
            element.append(dot, time);
        }
        const text = document.createElement('span');
        text.textContent = nameOf(occurrence);
        Object.assign(text.style, { overflow: 'hidden', textOverflow: 'ellipsis' });
        if (!continuous) paintText(text, occurrence);
        element.appendChild(text);
        element.title = occurrence.summary || '';
        paintPast(element, occurrence);
        element.addEventListener('click', (event) => {
            event.stopPropagation();
            showDetail(occurrence, element);
        });
        if (continuous) {
            element.addEventListener('mouseenter', () => {
                element.style.filter = 'brightness(1.12)';
            });
            element.addEventListener('mouseleave', () => {
                element.style.filter = 'none';
            });
        } else {
            element.addEventListener('mouseenter', () => {
                element.style.background = 'rgba(128,128,128,.16)';
            });
            element.addEventListener('mouseleave', () => {
                element.style.background = 'transparent';
            });
        }
        return element;
    };

    const laneGrid = (count) => {
        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid',
            gridTemplateColumns: `repeat(${count}, 1fr)`,
            height: LANE_HEIGHT + 'px',
        });
        return grid;
    };

    // Row 1 always: auto-placement never moves left again, so a later cell would spill onto a second row.
    const laneCell = (column, span) => {
        const cell = document.createElement('div');
        Object.assign(cell.style, { gridColumn: `${column + 1} / span ${span}`, gridRow: '1', minWidth: '0' });
        return cell;
    };

    /* How many lanes fit a row of the month on screen, or null before layout has given it a height.
     Drawing and the resize observer both read it, so they measure the same element. */
    let monthWeeks = null;
    const monthCapacity = () => {
        const rowHeight = monthWeeks.clientHeight / 6;
        return rowHeight > 0 ? Math.max(1, Math.floor((rowHeight - 24) / LANE_HEIGHT)) : null;
    };

    /* ================= month ================= */

    const renderMonth = () => {
        const [gridStart] = rangeOf();
        const all = visibleOccurrences(gridStart, addDays(gridStart, 42));
        const now = new Date();

        const weekHead = document.createElement('div');
        Object.assign(weekHead.style, {
            flex: '0 0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: 'var(--deckit-border)',
            opacity: '.6',
            font: '700 11.5px var(--deckit-font)',
        });
        for (const weekday of WEEKDAYS) {
            const cell = document.createElement('div');
            cell.textContent = weekday.toUpperCase();
            Object.assign(cell.style, { padding: '6px 8px', textAlign: 'center', letterSpacing: '.04em' });
            weekHead.appendChild(cell);
        }
        body.appendChild(weekHead);

        const weeks = document.createElement('div');
        Object.assign(weeks.style, {
            flex: '1 1 auto',
            minHeight: '0',
            display: 'grid',
            gridTemplateRows: 'repeat(6, 1fr)',
        });
        body.appendChild(weeks);
        monthWeeks = weeks;

        // Before the first layout the row has no height; the resize observer draws again once it has.
        const capacity = monthCapacity() ?? 3;
        lastCapacity = capacity;

        for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
            const weekStart = addDays(gridStart, weekIndex * 7);
            const items = rowItems(
                weekStart,
                7,
                all.filter((occurrence) => {
                    const lastDay = dayDelta(new Date(+occurrence.end - 1), weekStart);
                    return lastDay >= 0 && dayDelta(occurrence.start, weekStart) <= 6;
                })
            );
            const laneCount = assignLanes(items);
            const overflowing = laneCount > capacity;
            const visibleLanes = overflowing ? Math.max(0, capacity - 1) : laneCount;

            const week = document.createElement('div');
            Object.assign(week.style, {
                display: 'flex',
                flexDirection: 'column',
                minHeight: '0',
                overflow: 'hidden',
                borderBottom: weekIndex === 5 ? '0' : 'var(--deckit-border)',
            });

            const numbers = document.createElement('div');
            Object.assign(numbers.style, { flex: '0 0 auto', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' });
            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const day = addDays(weekStart, dayIndex);
                const cell = document.createElement('div');
                Object.assign(cell.style, {
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '3px 0 2px',
                    borderRight: dayIndex === 6 ? '0' : 'var(--deckit-border)',
                });
                const number = document.createElement('button');
                number.type = 'button';
                number.className = PLAIN_BUTTON;
                number.textContent = String(day.getDate());
                number.title = 'Open this day';
                // A day of another month steps back toward the ground: it is still a button.
                Object.assign(number.style, {
                    color:
                        day.getMonth() === cursor.getMonth()
                            ? 'var(--deckit-text)'
                            : 'color-mix(in srgb, var(--deckit-text) 38%, var(--deckit-background))',
                    font: '12.5px var(--deckit-font)',
                    padding: '1px 7px',
                    borderRadius: '10px',
                    transition: `background-color ${ease(theme.motion.fast)}`,
                });
                if (sameDay(day, now)) {
                    number.style.background = 'var(--deckit-accent)';
                    number.style.color = '#fff';
                    number.style.fontWeight = '700';
                } else {
                    ui.pressable(number);
                }
                number.addEventListener('click', () => goTo(day, 'day'));
                cell.appendChild(number);
                numbers.appendChild(cell);
            }

            const lanes = document.createElement('div');
            Object.assign(lanes.style, { flex: '1 1 auto', minHeight: '0', position: 'relative', overflow: 'hidden' });
            // Column rules sit behind the bars, so a bar crosses them uninterrupted.
            const rules = document.createElement('div');
            Object.assign(rules.style, {
                position: 'absolute',
                inset: '0',
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                pointerEvents: 'none',
            });
            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const rule = document.createElement('div');
                rule.style.borderRight = dayIndex === 6 ? '0' : 'var(--deckit-border)';
                rules.appendChild(rule);
            }
            lanes.appendChild(rules);

            const stack = document.createElement('div');
            Object.assign(stack.style, { position: 'relative' });
            for (let lane = 0; lane < visibleLanes; lane++) {
                const grid = laneGrid(7);
                for (const item of items.filter((candidate) => candidate.lane === lane)) {
                    const cell = laneCell(item.column, item.span);
                    cell.appendChild(bar(item.occurrence, item.span > 1 || item.occurrence.allDay));
                    grid.appendChild(cell);
                }
                stack.appendChild(grid);
            }
            if (overflowing) {
                const grid = laneGrid(7);
                for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                    const onDay = (item) => item.column <= dayIndex && dayIndex < item.column + item.span;
                    const hidden = items.filter((item) => item.lane >= visibleLanes && onDay(item));
                    const cell = laneCell(dayIndex, 1);
                    if (hidden.length) {
                        const day = addDays(weekStart, dayIndex);
                        const more = document.createElement('button');
                        more.type = 'button';
                        more.className = PLAIN_BUTTON;
                        more.textContent = `+${hidden.length} more`;
                        Object.assign(more.style, {
                            width: 'calc(100% - 4px)',
                            margin: '0 2px',
                            height: LANE_HEIGHT - 3 + 'px',
                            color: 'color-mix(in srgb, var(--deckit-text) 65%, var(--deckit-background))',
                            font: '11.5px var(--deckit-font)',
                            textAlign: 'left',
                            padding: '0 5px',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                        });
                        ui.pressable(more);
                        more.addEventListener('click', (event) => {
                            event.stopPropagation();
                            const dayOccurrences = items
                                .filter(onDay)
                                .map((item) => item.occurrence)
                                .sort(
                                    (first, second) =>
                                        isSpanning(second) - isSpanning(first) || first.start - second.start
                                );
                            showDayList(day, dayOccurrences, more);
                        });
                        cell.appendChild(more);
                    }
                    grid.appendChild(cell);
                }
                stack.appendChild(grid);
            }
            lanes.appendChild(stack);

            week.append(numbers, lanes);
            weeks.appendChild(week);
        }
    };

    /* ================= day and week ================= */

    // Overlapping events side by side, in columns within their own cluster.
    const layoutOverlaps = (items) => {
        items.sort((first, second) => first.start - second.start || second.end - first.end);
        let cluster = [],
            clusterEnd = 0;
        const flush = () => {
            const columnEnds = [];
            for (const item of cluster) {
                let column = columnEnds.findIndex((end) => end <= +item.start);
                if (column < 0) {
                    columnEnds.push(0);
                    column = columnEnds.length - 1;
                }
                columnEnds[column] = +item.end;
                item.column = column;
            }
            for (const item of cluster) item.columns = columnEnds.length;
            cluster = [];
        };
        for (const item of items) {
            if (cluster.length && +item.start >= clusterEnd) flush();
            cluster.push(item);
            clusterEnd = Math.max(clusterEnd, +item.end);
        }
        if (cluster.length) flush();
        return items;
    };

    const renderTimeGrid = (days) => {
        const from = days[0],
            to = addDays(days[days.length - 1], 1);
        const all = visibleOccurrences(from, to);
        const spanning = all.filter(isSpanning);
        const timed = all.filter((occurrence) => !isSpanning(occurrence));
        const now = new Date();
        const columns = `${GUTTER_WIDTH} repeat(${days.length}, 1fr)`;

        const dayHead = document.createElement('div');
        Object.assign(dayHead.style, {
            flex: '0 0 auto',
            display: 'grid',
            gridTemplateColumns: columns,
            borderBottom: 'var(--deckit-border)',
        });
        dayHead.appendChild(document.createElement('div'));
        for (const day of days) {
            const cell = document.createElement('div');
            Object.assign(cell.style, { padding: '6px 4px', textAlign: 'center', borderLeft: 'var(--deckit-border)' });
            const weekday = document.createElement('div');
            weekday.textContent = WEEKDAYS[day.getDay()].toUpperCase();
            Object.assign(weekday.style, {
                font: '700 11px var(--deckit-font)',
                opacity: '.55',
                letterSpacing: '.04em',
            });
            const number = document.createElement('div');
            number.textContent = String(day.getDate());
            Object.assign(number.style, {
                font: '600 15px var(--deckit-font)',
                marginTop: '2px',
                display: 'inline-block',
                padding: '0 7px',
                borderRadius: '11px',
                lineHeight: '22px',
            });
            if (sameDay(day, now)) {
                number.style.background = 'var(--deckit-accent)';
                number.style.color = '#fff';
            }
            cell.append(weekday, number);
            dayHead.appendChild(cell);
        }
        body.appendChild(dayHead);

        if (spanning.length) {
            const strip = document.createElement('div');
            Object.assign(strip.style, {
                flex: '0 0 auto',
                display: 'grid',
                gridTemplateColumns: columns,
                borderBottom: 'var(--deckit-border)',
                padding: '3px 0',
            });
            const label = document.createElement('div');
            label.textContent = 'All day';
            Object.assign(label.style, {
                font: '11px var(--deckit-font)',
                opacity: '.5',
                padding: '2px 8px',
                textAlign: 'right',
            });
            strip.appendChild(label);
            const holder = document.createElement('div');
            Object.assign(holder.style, { gridColumn: `2 / span ${days.length}`, minWidth: '0' });
            const items = rowItems(days[0], days.length, spanning);
            const laneCount = assignLanes(items);
            for (let lane = 0; lane < laneCount; lane++) {
                const grid = laneGrid(days.length);
                for (const item of items.filter((candidate) => candidate.lane === lane)) {
                    const cell = laneCell(item.column, item.span);
                    cell.appendChild(bar(item.occurrence, true));
                    grid.appendChild(cell);
                }
                holder.appendChild(grid);
            }
            strip.appendChild(holder);
            body.appendChild(strip);
        }

        const scroller = document.createElement('div');
        Object.assign(scroller.style, { flex: '1 1 auto', minHeight: '0', overflowY: 'auto' });
        const sheet = document.createElement('div');
        Object.assign(sheet.style, { display: 'grid', gridTemplateColumns: columns, height: 24 * HOUR_HEIGHT + 'px' });

        const gutter = document.createElement('div');
        Object.assign(gutter.style, { position: 'relative' });
        for (let hour = 1; hour < 24; hour++) {
            const label = document.createElement('div');
            label.textContent = String(hour).padStart(2, '0') + ':00';
            Object.assign(label.style, {
                position: 'absolute',
                right: '8px',
                top: hour * HOUR_HEIGHT - 7 + 'px',
                font: '11px var(--deckit-font)',
                opacity: '.45',
            });
            gutter.appendChild(label);
        }
        sheet.appendChild(gutter);

        for (const day of days) {
            const dayColumn = document.createElement('div');
            Object.assign(dayColumn.style, {
                position: 'relative',
                borderLeft: 'var(--deckit-border)',
                background: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_HEIGHT - 1}px, rgba(128,128,128,.18) ${HOUR_HEIGHT - 1}px ${HOUR_HEIGHT}px)`,
            });
            const items = layoutOverlaps(
                timed.filter((occurrence) => sameDay(occurrence.start, day)).map((occurrence) => ({ ...occurrence }))
            );
            for (const item of items) {
                const startMinute = item.start.getHours() * 60 + item.start.getMinutes();
                const endMinute = Math.min(24 * 60, startMinute + Math.max(20, (+item.end - +item.start) / 60000));
                const element = document.createElement('div');
                Object.assign(element.style, {
                    position: 'absolute',
                    top: (startMinute / 60) * HOUR_HEIGHT + 'px',
                    height: ((endMinute - startMinute) / 60) * HOUR_HEIGHT - 2 + 'px',
                    left: `calc(${(item.column / item.columns) * 100}% + 2px)`,
                    width: `calc(${(1 / item.columns) * 100}% - 4px)`,
                    background: item.color,
                    color: '#fff',
                    borderRadius: '5px',
                    padding: '2px 6px',
                    font: '12px var(--deckit-font)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    transition: `filter ${ease(theme.motion.fast)}, box-shadow ${ease(theme.motion.fast)}`,
                });
                element.addEventListener('mouseenter', () => {
                    element.style.filter = 'brightness(1.12)';
                    element.style.boxShadow = '0 2px 8px rgba(0,0,0,.28)';
                });
                element.addEventListener('mouseleave', () => {
                    element.style.filter = 'none';
                    element.style.boxShadow = 'none';
                });
                paintSolid(element, item);
                paintPast(element, item);
                const time = document.createElement('div');
                time.textContent = clockText(item.start) + '–' + clockText(item.end);
                Object.assign(time.style, { opacity: '.85', font: '11px var(--deckit-font)' });
                const name = document.createElement('div');
                name.textContent = nameOf(item);
                Object.assign(name.style, { fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' });
                element.append(time, name);
                element.title = item.summary || '';
                element.addEventListener('click', (event) => {
                    event.stopPropagation();
                    showDetail(item, element);
                });
                dayColumn.appendChild(element);
            }
            if (sameDay(day, now)) {
                const line = document.createElement('div');
                Object.assign(line.style, {
                    position: 'absolute',
                    left: '0',
                    right: '0',
                    height: '2px',
                    background: 'var(--deckit-alert)',
                    top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT + 'px',
                    pointerEvents: 'none',
                });
                dayColumn.appendChild(line);
            }
            sheet.appendChild(dayColumn);
        }

        scroller.appendChild(sheet);
        scroller.addEventListener('scroll', () => {
            hourScroll = scroller.scrollTop;
        });
        body.appendChild(scroller);
        requestAnimationFrame(() => {
            scroller.scrollTop = hourScroll;
        });
    };

    /* ================= empty state ================= */

    const emptyAction = ui.button({
        label: 'Add account',
        size: 'small',
        onClick: () => {
            if (!accounts().length) addAccount();
            else accountSheet(accounts()[0]);
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

    /* ================= sign-in ================= */

    /* The provider signs the account in, in a window of its own, and answers the address it signed
     in as, or nothing when it was cancelled. A cancelled or failed sign-in leaves nothing behind. */
    // provider mod id -> { name, count, asks }: its sign-ins under way, and the questions they have open
    const signingIn = new Map();
    const signIn = async (provider, account, title) => {
        const signing = signingIn.get(account.provider) || { name: provider.name, count: 0, asks: new Set() };
        signing.count++;
        signingIn.set(account.provider, signing);
        render();
        try {
            return await provider.signIn(account, { title });
        } finally {
            if (--signing.count === 0) {
                signingIn.delete(account.provider);
                for (const close of signing.asks) close();
            }
            render();
        }
    };

    /* What the provider signing in asks the person on the way (README.md, Asking): Calendar comes on screen and
     asks in a dialog under the provider's name. Resolves whether the person confirmed, and false once the
     provider has no sign-in under way. A mod that is not signing in is refused. */
    const ask = ({ message, detail = '', confirmLabel = 'OK', cancelLabel = 'Cancel' } = {}) => {
        const signing = signingIn.get(deck.caller());
        if (!signing) return Promise.reject(new Error('Calendar asks only for the provider signing in'));
        deck.show();
        return new Promise((resolve) => {
            let confirmed = false;
            const dialog = ui.dialog({
                title: signing.name,
                message: [String(message ?? ''), String(detail ?? '')],
                confirmLabel: String(confirmLabel),
                cancelLabel: String(cancelLabel),
                onConfirm: () => (confirmed = true),
                // The dialog closes before it confirms.
                onClose: () => {
                    signing.asks.delete(dialog.close);
                    queueMicrotask(() => resolve(confirmed));
                },
            });
            signing.asks.add(dialog.close);
        });
    };

    content.append(head, body, firstLoad, empty);

    new ResizeObserver(() => {
        if (mode !== 'month' || !monthWeeks) return;
        const capacity = monthCapacity();
        if (capacity !== null && capacity !== lastCapacity) render();
    }).observe(body);

    /* ================= sidebar ================= */

    const sidebar = document.createElement('div');
    Object.assign(sidebar.style, { display: 'flex', flexDirection: 'column', minHeight: '0', flex: '1 1 auto' });

    const accountList = document.createElement('div');

    // A provider's icon is another mod's text: drawn from its shapes alone.
    const glyph = (svg, size = 14) => {
        const holder = document.createElement('span');
        const icon = ui.sanitizeIcon(svg);
        icon.setAttribute('width', size);
        icon.setAttribute('height', size);
        holder.append(icon);
        Object.assign(holder.style, { display: 'flex', flex: '0 0 auto' });
        return holder;
    };

    const sheetText = (text, style = {}) => {
        const element = document.createElement('div');
        element.textContent = text;
        Object.assign(element.style, { font: '13px var(--deckit-font)', ...style });
        return element;
    };

    const addAccount = () => {
        const handle = ui.modal({
            title: 'Add account',
            confirmLabel: null,
            fill(card) {
                if (!Object.keys(providers()).length) {
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
                for (const [id, provider] of Object.entries(providers())) {
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
                    row.append(glyph(provider.icon, 22), words);
                    row.addEventListener('click', () => {
                        handle.close();
                        connect(id);
                    });
                    card.appendChild(row);
                }
                card.lastChild.style.marginBottom = '14px';
            },
        });
    };

    const connect = async (providerId) => {
        const provider = providers()[providerId];
        if (!provider) return;
        const account = { id: Date.now().toString(36), provider: providerId, email: '' };
        let email;
        try {
            email = await signIn(provider, account, `Add ${provider.name} account`);
        } catch (error) {
            return ui.dialog({ title: 'Add account', message: String(error.message || error), confirmLabel: 'OK' });
        }
        if (!email) return;
        const same = accounts().find((existing) => existing.provider === providerId && existing.email === email);
        if (same) {
            forget(provider, account);
            return accountSheet(same);
        }
        account.email = email;
        saveAccounts([...accounts(), account]);
        render();
        accountSheet(account, { fresh: true });
    };

    // Signing an account back in has to end on the same person, or it is not that account.
    const reconnect = async (account) => {
        const provider = providerOf(account);
        if (!provider) return;
        let email;
        try {
            email = await signIn(provider, account, `Sign in to ${account.email}`);
        } catch (error) {
            return ui.dialog({ title: 'Sign in', message: String(error.message || error), confirmLabel: 'OK' });
        }
        if (!email) return;
        if (email !== account.email) {
            await forget(provider, account);
            return ui.dialog({
                title: 'Different account',
                message: `That signed in as ${email || 'someone else'}, not ${account.email}. Sign in again with ${account.email}.`,
                confirmLabel: 'OK',
            });
        }
        // What was read stays until the next read replaces it: if that read fails, it is all there is.
        refresh(true);
    };

    const removeAccount = async (account) => {
        saveAccounts(accounts().filter((existing) => existing.id !== account.id));
        saveFeeds(feeds()); // feeds() already leaves out the removed account's calendars
        reads.dropAccount(account.id);
        accountStatus.delete(account.id);
        render();
        const provider = providerOf(account);
        if (provider) await forget(provider, account);
        else keep(FORGOTTEN, [...records.get(FORGOTTEN, []), account]);
    };

    // A new account starts with the calendars its own calendar app shows.
    const accountSheet = (account, { fresh = false } = {}) => {
        const provider = providerOf(account) || { name: account.provider, icon: ui.icon('info') };
        const shown = new Set(
            feeds()
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
                who.append(glyph(provider.icon, 16), sheetText(provider.name, { opacity: '.6' }));
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
                    (
                        providerOf(account)?.calendars(account) ||
                        Promise.reject(
                            new Error(`${account.provider} is not running, so its calendars cannot be read.`)
                        )
                    )
                        .then((found) => {
                            calendars = found;
                            list.textContent = '';
                            for (const entry of found) {
                                chosen.set(
                                    entry.id,
                                    shown.has(entry.id) || (fresh && (entry.primary || entry.selected))
                                );
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
                                list.appendChild(row);
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
                                            reconnect(account);
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
                let list = feeds();
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
                saveFeeds(list);
                fetchedAt = 0;
                refresh(true);
            },
        });
    };

    const editDialog = (feed) =>
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
                    value: remindsAll(feed),
                },
            ],
            onConfirm: ({ label, color, remindAll }) =>
                updateFeed(keyOf(feed), { label: label.trim() || feed.label, color, remindAll }),
        });

    const removeDialog = (feed) =>
        ui.dialog({
            title: 'Remove calendar',
            message: `${feed.label || feed.calendar} will no longer be shown. The calendar itself is untouched.`,
            confirmLabel: 'Remove',
            destructive: true,
            onConfirm: () => removeFeed(keyOf(feed)),
        });

    const accountRow = (account) => {
        const state = statusOf(account.id);
        const row = ui.row().element;
        Object.assign(row.style, { minHeight: '24px', font: '12.5px var(--deckit-font)' });
        const who = document.createElement('span');
        who.textContent = account.email;
        const provider = providerOf(account);
        who.title = (provider ? provider.name : `${account.provider}, not running`) + ' · ' + account.email;
        Object.assign(who.style, {
            flex: '1 1 auto',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: '.6',
        });
        row.append(glyph(provider ? provider.icon : ui.icon('info'), 13), who);
        if (state.loading) row.appendChild(ui.spinner({ size: 12 }).element);
        // A button rather than a rowAction, which shows only on hover: this has to be seen.
        if (state.signedOut && !state.loading) {
            const signInButton = ui.button({
                label: 'Sign in',
                title: 'Signed out. Sign in again',
                size: 'small',
                onClick: (event) => {
                    event.stopPropagation();
                    reconnect(account);
                },
            }).element;
            Object.assign(signInButton.style, { color: 'var(--deckit-alert)', borderColor: 'var(--deckit-alert)' });
            row.appendChild(signInButton);
        }
        row.appendChild(
            ui.rowAction({ icon: ui.icon('gear'), title: 'Account', onClick: () => accountSheet(account) }).element
        );
        row.addEventListener('click', () => accountSheet(account));
        return row;
    };

    // `feed` is the keyed list's item, its error included, so a change to either draws it again.
    const feedRow = (feed) => {
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
            transition: `background-color ${ease(theme.motion.base)}, border-color ${ease(theme.motion.base)}`,
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
            ui.rowAction({ icon: ui.icon('pencil'), title: 'Edit name and color', onClick: () => editDialog(feed) })
                .element,
            ui.rowAction({ icon: ui.icon('x'), title: 'Remove', onClick: () => removeDialog(feed) }).element
        );
        row.dataset.feed = keyOf(feed);
        row.addEventListener('click', () => updateFeed(keyOf(feed), { hidden: !feed.hidden }));
        return row;
    };
    ui.contextMenu(accountList, {
        rowAt: (target) => target.closest?.('[data-feed]') || null,
        items: (row) => {
            const feed = row && feeds().find((candidate) => keyOf(candidate) === row.dataset.feed);
            if (!feed) return null;
            return [
                {
                    label: feed.hidden ? 'Show' : 'Hide',
                    icon: feed.hidden ? 'eye' : 'eyeOff',
                    run: () => updateFeed(keyOf(feed), { hidden: !feed.hidden }),
                },
                {
                    label: 'Show Only This',
                    icon: 'eye',
                    run: () => {
                        saveFeeds(feeds().map((other) => ({ ...other, hidden: keyOf(other) !== keyOf(feed) })));
                        render();
                    },
                },
                '-',
                { label: 'Edit Name and Color…', icon: 'pencil', run: () => editDialog(feed) },
                { label: 'Remove…', icon: 'x', run: () => removeDialog(feed) },
            ];
        },
    });

    /* One block per account: its row, then its calendars as a keyed list, reordered within the
     account only. Blocks are kept from one draw to the next, so a drag holds the list that is drawn
     into and the redraw waits for the drop. */
    const blocks = new Map(); // account id -> { element, row, list }
    const blockOf = (account) => {
        if (blocks.has(account.id)) return blocks.get(account.id);
        const list = ui.list({ key: (item) => item.key, create: feedRow, exit: true });
        ui.sortable(list, {
            onReorder: (key, toKey) => {
                const mine = feeds().filter((feed) => feed.account === account.id);
                const from = mine.findIndex((feed) => keyOf(feed) === key);
                const to = mine.findIndex((feed) => keyOf(feed) === toKey);
                if (from < 0 || to < 0) return;
                mine.splice(to, 0, ...mine.splice(from, 1));
                let next = 0;
                saveFeeds(feeds().map((feed) => (feed.account === account.id ? mine[next++] : feed)));
                render();
            },
        });
        const element = document.createElement('div');
        element.append(list.element);
        const block = { element, row: null, list };
        blocks.set(account.id, block);
        return block;
    };
    const renderFeeds = () => {
        const shown = accounts();
        for (const [id, block] of blocks)
            if (!shown.some((account) => account.id === id)) {
                block.element.remove();
                blocks.delete(id);
            }
        const all = feeds();
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
                        error: (providerOf(account) && reads.of(feed)?.error) || '',
                    }))
            );
            return block.element;
        });
        if (
            order.length !== accountList.children.length ||
            order.some((element, index) => accountList.children[index] !== element)
        ) {
            accountList.replaceChildren(...order);
        }
    };

    // The date and time cells keep their width when empty, so an all-day entry lines up with a timed one.
    const agendaRow = (occurrence, showDate) => {
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
            date.textContent = `${occurrence.start.getMonth() + 1}/${occurrence.start.getDate()} (${WEEKDAYS_KO[occurrence.start.getDay()]})`;
            Object.assign(date.style, {
                flex: '0 0 auto',
                width: '62px',
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
        row.addEventListener('click', () => showDetail(occurrence, row));
        return row;
    };

    const emptyRow = (text) => {
        const row = ui.row().element;
        row.textContent = text;
        Object.assign(row.style, { opacity: '.45', cursor: 'default', font: '13px var(--deckit-font)' });
        return row;
    };

    const folds = () => values.get('folds', {});
    const setFold = (key, folded) => values.set('folds', { ...folds(), [key]: folded });

    const foldingSection = (label, icon, key, actions = []) => {
        const section = ui.section({
            label,
            icon: ui.icon(icon, { size: 16 }),
            actions,
            collapsed: !!folds()[key],
            onToggle: (next) => {
                setFold(key, next);
                section.setCollapsed(next);
            },
        });
        return section;
    };
    const feedHead = foldingSection('Calendars', 'layers', 'calendars', [
        { title: 'Add account', run: () => addAccount() },
    ]);
    const todayHead = foldingSection('Today', 'calendarDays', 'today');
    // Plain boxes drawn whole, not keyed lists: a row leaving means only that time moved.
    const todayList = document.createElement('div');
    const upcomingHead = foldingSection('Upcoming', 'clock', 'upcoming');
    const upcomingList = document.createElement('div');

    const renderAgenda = () => {
        todayList.textContent = '';
        upcomingList.textContent = '';
        const has = feeds().length > 0;
        todayHead.element.style.display = has ? '' : 'none';
        upcomingHead.element.style.display = has ? '' : 'none';

        if (!has) return;

        const now = new Date();
        const dayStart = startOfDay(now),
            tomorrow = addDays(dayStart, 1);
        const today = visibleOccurrences(dayStart, tomorrow);
        if (today.length) for (const occurrence of today) todayList.appendChild(agendaRow(occurrence, false));
        else todayList.appendChild(emptyRow('Nothing today'));

        const soon = visibleOccurrences(tomorrow, addDays(tomorrow, 14)).slice(0, 10);
        if (soon.length) for (const occurrence of soon) upcomingList.appendChild(agendaRow(occurrence, true));
        else upcomingList.appendChild(emptyRow('Nothing in the next two weeks'));
    };

    feedHead.body.appendChild(accountList);
    todayHead.body.appendChild(todayList);
    upcomingHead.body.appendChild(upcomingList);
    sidebar.append(feedHead.element, todayHead.element, upcomingHead.element);

    /* ================= render ================= */

    const render = () => {
        if (!visible || detail.isOpen()) {
            drawPending = true;
            return;
        }
        drawPending = false;
        title.textContent = titleOf();
        modeBar.set(mode);
        showSpinner(loading);
        const signedOut = accounts().filter((account) => accountStatus.get(account.id)?.signedOut).length;
        const broken = feeds().filter((feed) => reads.of(feed)?.error).length;
        const unprovided = accounts().filter((account) => !providerOf(account)).length;
        status.textContent = signingIn.size
            ? 'Signing in…'
            : loading
              ? 'Loading…'
              : unprovided
                ? `${unprovided} account(s) wait for the mod that provides them`
                : signedOut
                  ? `${signedOut} account(s) signed out`
                  : broken
                    ? `${broken} calendar(s) failed to load`
                    : fetchedAt
                      ? 'Updated ' + clockText(new Date(fetchedAt))
                      : '';

        const noAccount = !accounts().length,
            blank = !feeds().length;
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
        const firstRead = !blank && loading && feeds().every((feed) => !reads.has(feed));
        firstLoad.style.display = firstRead ? 'flex' : 'none';
        // Hidden rather than painted over, so the panel's glass shows through the overlays.
        head.style.visibility = blank || firstRead ? 'hidden' : '';
        body.style.visibility = blank || firstRead ? 'hidden' : '';

        // Only a move to another range fades in: a background refresh of the same range should not blink.
        const viewKey = mode + '@' + +rangeOf()[0];
        const navigated = viewKey !== lastViewKey;
        lastViewKey = viewKey;

        body.textContent = '';
        if (mode === 'month') renderMonth();
        else if (mode === 'week')
            renderTimeGrid(Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursor), index)));
        else renderTimeGrid([cursor]);

        if (navigated) fade(body, theme.motion.fast);

        renderFeeds();
        renderAgenda();
    };

    // Asked where the range moves and on the minute, not from render: render is put off while hidden, and the read must not be.
    const follow = () => {
        if (!loading && feeds().some((feed) => !covers(reads.of(feed)))) refresh(true);
    };

    /* ================= reminders ================= */

    /* Fired once per occurrence and recorded in a file, so a restart before a meeting does not
     announce it again. The key carries the start time, so a moved meeting is announced anew. */
    const FIRED_KEY = 'notified';
    const reminderLead = () => {
        const lead = settings.get('notify');
        return lead === 'off' ? null : REMINDER_LEADS.includes(lead) ? lead : DEFAULT_LEAD;
    };

    // Chromium gives a background page timers once a minute at most, still inside every lead but "at start time".
    const CHECK_MS = 30 * 1000;
    const AT_START_GRACE_MS = 2 * 60 * 1000;

    const occurrenceKey = (occurrence) => (occurrence.uid || occurrence.summary || '?') + '@' + +occurrence.start;

    /* A meeting the user was invited to and did not decline, or anything on a calendar set to notify
     for everything. A colleague's calendar is there to be looked at, not to speak for the user. */
    const attends = (occurrence) => occurrence.rsvp !== 'DECLINED' && (!!occurrence.rsvp || occurrence.remindAll);

    /* The notice and the switcher card both ask this, so they agree. Something already under way is
     not announced late; "at start time" alone is allowed a grace after the start. */
    const isDue = (occurrence, at, lead) => {
        if (lead === null || isSpanning(occurrence) || !attends(occurrence)) return false;
        const left = +occurrence.start - at;
        return left <= lead * 60000 && left > (lead === 0 ? -AT_START_GRACE_MS : 0);
    };

    /* Recorded only once the notice was shown, so a notice that failed is tried again while still
     due. `pending` keeps a check from sending one that is still on its way. */
    const pending = new Set();
    const remember = (key, start) => {
        const fired = records.get(FIRED_KEY, {});
        fired[key] = start;
        const cutoff = Date.now() - 24 * 3600000;
        for (const [firedKey, firedStart] of Object.entries(fired)) if (firedStart < cutoff) delete fired[firedKey];
        keep(FIRED_KEY, fired);
    };

    const remind = (occurrence, left) => {
        const minutes = Math.round(left / 60000);
        return deck.notify({
            title: nameOf(occurrence),
            body: `${minutes > 0 ? `in ${minutes} min` : 'now'} · ${clockText(occurrence.start)}`,
            onClick: () => {
                deck.show();
                goTo(occurrence.start);
            },
        });
    };

    const notifyDue = () => {
        const lead = reminderLead();
        if (lead === null) return;
        const at = Date.now();
        const fired = records.get(FIRED_KEY, {});

        for (const occurrence of visibleOccurrences(startOfDay(new Date(at)), addDays(startOfDay(new Date(at)), 2))) {
            if (!isDue(occurrence, at, lead)) continue;
            const left = +occurrence.start - at;
            const key = occurrenceKey(occurrence);
            if (fired[key] || pending.has(key)) continue;
            pending.add(key);
            Promise.resolve(remind(occurrence, left))
                .then((shown) => {
                    if (shown) remember(key, +occurrence.start);
                })
                .catch(() => {})
                .finally(() => pending.delete(key));
        }
    };

    settings.on((key) => {
        if (key === 'notify') notifyDue();
    });

    setInterval(notifyDue, CHECK_MS);
    // refresh() decides for itself whether a read is due, so asking every minute costs nothing.
    setInterval(() => {
        refresh();
        follow();
    }, 60 * 1000);

    render();
    // A provider that starts reads its accounts at once; one that ends leaves what was read.
    accountsPoint.onChange(() => {
        forgetWaiting();
        render();
        refresh(true);
    });
    refresh();

    // Being past changes with the clock alone, and so does the current-time line.
    setInterval(render, 60 * 1000);

    return {
        content,
        sidebar,
        ask,
        didAppear() {
            visible = true;
            refresh();
            render();
            follow();
        },
        didDisappear() {
            visible = false;
            closeDetail();
        },

        keys: {
            today: { key: 'mod+t', label: 'Go to today', run: () => goTo(new Date()) },
            dayView: { key: 'mod+1', label: 'Day view', run: () => setMode('day') },
            weekView: { key: 'mod+2', label: 'Week view', run: () => setMode('week') },
            monthView: { key: 'mod+3', label: 'Month view', run: () => setMode('month') },
            previous: { key: 'mod+left', label: 'Previous', run: () => shift(-1) },
            next: { key: 'mod+right', label: 'Next', run: () => shift(1) },
        },

        /* What is running, and what is next once the running one is past its midpoint (or nothing is
       running), and only within NOW_HORIZON_MS. */
        now: () => {
            const at = new Date();
            const soon = new Date(+at + NOW_HORIZON_MS);
            const lead = reminderLead();
            const timed = visibleOccurrences(startOfDay(at), addDays(startOfDay(at), 2)).filter(
                (occurrence) => !isSpanning(occurrence) && attends(occurrence)
            );

            const running = timed.find((occurrence) => +occurrence.start <= +at && +occurrence.end > +at);
            const next = timed.find((occurrence) => +occurrence.start > +at && +occurrence.start <= +soon);

            const card = (occurrence, live) => ({
                label: nameOf(occurrence),
                hint: live
                    ? `In progress · until ${clockText(occurrence.end)}`
                    : `${untilText(occurrence.start, at)} · ${clockText(occurrence.start)}`,
                icon: ui.icon('clock', { size: 18 }),
                // Asks for attention while the notice would be due, so the two say the same thing.
                attention: !live && isDue(occurrence, +at, lead),
                run: () => {
                    deck.show();
                    goTo(occurrence.start);
                },
            });

            const out = [];
            if (running) out.push(card(running, true));
            const halfway = running ? +running.start + (+running.end - +running.start) / 2 : 0;
            if (next && (!running || +at >= halfway)) out.push(card(next, false));
            return out;
        },

        commands: () => [
            {
                label: 'Go to Today',
                icon: ui.icon('calendarDays'),
                keywords: ['오늘', 'today'],
                run: () => {
                    deck.show();
                    goTo(new Date());
                },
            },
            ...MODES.map(([key, label]) => ({
                label: label + ' View',
                icon: ui.icon('layers'),
                keywords: [{ day: '일간', week: '주간', month: '월간' }[key], '보기', 'view'],
                run: () => {
                    deck.show();
                    setMode(key);
                },
            })),
            {
                label: 'Add Calendar Account…',
                icon: ui.icon('plus'),
                keywords: ['계정', '추가', 'account'],
                run: () => {
                    deck.show();
                    addAccount();
                },
            },
        ],
    };
};

module.exports = { calendar, REMINDER_LEADS, DEFAULT_LEAD, leadText };
