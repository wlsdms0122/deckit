// The notifications on screen: the toasts `center` lets out, stacked in the mod's overlay window over every app, open
// while it shows any, each as tall as what it holds, which leave the keyboard where it is; and on `showList()` the
// notification center, the record newest first to press, remove or clear, in a panel window along the right edge of
// the desktop, open only with the keyboard: it takes it as it opens, closes at once where it opens without it, as
// Notifications may not activate (DECKIT-32), and goes as the keyboard leaves it or Escape is pressed. Its rows are a
// list the pointer and the arrows move along: Return runs the row's notification as a press does and Command-Delete
// removes it. No toast shows while the center is open, which holds them all. A toast with actions stays until one is
// pressed or it is closed; any other leaves after a time. A press on a toast, a row or an action is the center's.
const WIDTH = 360;
const GAP = 8;
// Room around the cards in the window for the shadow they cast, deeper below, where the shadow falls.
const ROOM = 16;
const ROOM_BELOW = 24;
// What a toast is drawn in at most, its title, two lines of body and a row of actions: the window's height for each
// until they are measured.
const TOAST_MOST = 112;
// How long a toast with no actions stays.
const STAYS = 6000;

// The app's own type, not the reading font: a toast is part of the app, not a page.
const STYLE = `
    .notifications {
        display: flex;
        flex-direction: column;
        gap: ${GAP}px;
        box-sizing: border-box;
        height: 100%;
        padding: ${ROOM}px ${ROOM}px ${ROOM_BELOW}px;
        overflow-y: auto;
        color: var(--deckit-text);
        font: var(--deckit-type-body);
    }
    .notifications-card {
        position: relative;
        display: flex;
        flex: 0 0 auto;
        align-items: flex-start;
        gap: 8px;
        box-sizing: border-box;
        padding: 12px 36px 12px 12px;
        border-radius: var(--deckit-radius-card);
        background: var(--deckit-elevated);
        box-shadow: var(--deckit-rim), var(--deckit-shadow-float);
        cursor: default;
    }
    /* The center lies on the panel window's material: its head and the empty record on it, the rows on cards. */
    .notifications-center { padding-bottom: ${ROOM}px; }
    .notifications-head {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: space-between;
        min-height: 32px;
        font: 600 var(--deckit-type-heading);
    }
    .notifications-rows { display: flex; flex-direction: column; gap: ${GAP}px; }
    /* A row under the pointer or the keys is washed over its card, pressed deeper, and ringed while the keys moved
       to it. */
    .notifications-rows .notifications-card[data-active] {
        background: linear-gradient(var(--deckit-hover), var(--deckit-hover)), var(--deckit-elevated);
    }
    .notifications-rows .notifications-card:active {
        background: linear-gradient(var(--deckit-pressed), var(--deckit-pressed)), var(--deckit-elevated);
    }
    .notifications-rows[data-keyed] .notifications-card[data-active] {
        outline: 2px solid var(--deckit-focus);
        outline-offset: 2px;
    }
    .notifications-words { display: flex; flex: 1 1 auto; flex-direction: column; gap: 2px; min-width: 0; }
    .notifications-title-row { display: flex; align-items: baseline; gap: 8px; min-height: 20px; }
    .notifications-title {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .notifications-body {
        display: -webkit-box;
        overflow: hidden;
        color: var(--deckit-muted);
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
    }
    .notifications-time {
        flex: 0 0 auto;
        color: var(--deckit-muted);
        font: var(--deckit-type-caption);
        font-variant-numeric: tabular-nums;
    }
    .notifications-actions { display: flex; gap: 6px; margin-top: 4px; }
    .notifications-close { position: absolute; top: 10px; right: 6px; }
`;

function screen(shell, center, { onCenter = () => {} } = {}) {
    // MARK: - Property
    const { ui } = shell;
    const content = document.createElement('div'); // the toasts
    content.className = 'notifications';
    const list = document.createElement('div'); // the notification center
    list.className = 'notifications notifications-center';
    shell.ui.addStyle(STYLE);
    // The center's rows, by the notification's id, and the one the pointer or the keys are on.
    const rows = ui.list({
        key: (notification) => notification.id,
        create: (notification) => card(notification, { row: true }),
        update: (made, notification) => made.replaceChildren(...partsOf(notification, { row: true })),
    });
    rows.element.classList.add('notifications-rows');
    let shown = []; // the notifications the rows show, in order
    // A row is pressed as the press is let go, by its card's click, not as the list picks on the press.
    const choice = ui.listbox(rows.element, {
        onPick: () => {},
        onActivate: (_index, { pointer }) => rows.element.toggleAttribute('data-keyed', !pointer),
    });
    const toasts = new Map(); // id -> { notification, timer, leaving }
    const toastCards = new Map(); // id -> its toast's card, kept while it shows
    const icons = new Map(); // a sending mod's id -> its app icon, as the shell reads it
    let window = null; // the toasts' window, while it is open
    let panel = null; // the center's window, while it is open
    const offs = [
        center.drawWith({ show: showToast, hide: (id) => hideToast(id, { told: false }), active: shell.active }),
        center.onChange(() => panel && drawList()),
    ];

    // MARK: - Initializer
    // MARK: - Public
    // The center opened, or made key where it is open; `onCenter(open)` hears it open and close.
    async function showList() {
        await Promise.all(center.list().map((notification) => iconRead(notification.mod.id)));
        if (panel) return panel.makeKeyAndOrderFront();
        drawList();
        const opened = shell.windows.open({
            name: 'center',
            content: list,
            level: 'panel',
            edge: 'right',
            width: WIDTH,
            didAppear: () => panel === opened && !opened.isKey && closeList(),
            didResignKey: () => panel === opened && closeList(),
            didClose: () => panel === opened && closed(),
        });
        panel = opened;
        list.ownerDocument.addEventListener('keydown', (event) => {
            if (event.defaultPrevented || panel !== opened) return;
            const row = shown[choice.active()];
            const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
            if (event.key === 'Escape') closeList();
            else if (plain && (event.key === 'ArrowDown' || event.key === 'ArrowUp'))
                choice.move(event.key === 'ArrowDown' ? 1 : -1);
            else if (plain && event.key === 'Enter' && row) center.press(row.id);
            else if (event.metaKey && event.key === 'Backspace' && row) center.remove(row.id);
            else return;
            event.preventDefault();
        });
        toToasts();
        onCenter(true);
    }

    // The center opened where it is closed, or closed where it is open: answers whether it is open after.
    async function toggle() {
        if (panel) {
            closeList();
            return false;
        }
        await showList();
        return true;
    }

    function end() {
        for (const off of offs) off();
        for (const { timer } of toasts.values()) clearTimeout(timer);
        toasts.clear();
    }

    // MARK: - Private
    function closeList() {
        const was = panel;
        if (!was) return;
        closed();
        was.close();
    }

    // The toasts held back while the center was open show again.
    function closed() {
        panel = null;
        toToasts();
        onCenter(false);
    }

    // A toast shows once its sender's icon is read, so the default icon never stands in for it first.
    async function showToast(notification) {
        await iconRead(notification.mod.id);
        const timer = notification.actions.length ? 0 : setTimeout(() => hideToast(notification.id), STAYS);
        toasts.set(notification.id, { notification, timer });
        toToasts();
    }

    // `told`: the center is told the toast is gone, unless it is the one that took it away. A toast on screen fades
    // out first.
    function hideToast(id, { told = true } = {}) {
        const toast = toasts.get(id);
        if (!toast || toast.leaving) return;
        clearTimeout(toast.timer);
        toast.leaving = true;
        const gone = () => {
            toasts.delete(id);
            if (told) center.toastGone(id);
            toToasts();
        };
        const card = toastCards.get(id);
        if (panel || !card?.isConnected) return gone();
        const { fade, easing } = shell.theme.motion.exit;
        card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade, easing, fill: 'forwards' });
        setTimeout(gone, fade);
    }

    // The toasts' window, open while it shows any and the center is closed.
    function toToasts() {
        drawToasts();
        if (!toasts.size || panel) {
            window?.close();
            window = null;
            return;
        }
        if (!window) open(around(toasts.size * TOAST_MOST, toasts.size));
        fit();
    }

    // The window as tall as the toasts it shows, once they are laid out in it.
    function fit() {
        const view = content.ownerDocument.defaultView;
        view.requestAnimationFrame(() => {
            if (panel || !window || !content.isConnected) return;
            const cards = [...content.children];
            const height = cards.reduce((sum, card) => sum + card.getBoundingClientRect().height, 0);
            window.resize(WIDTH, Math.ceil(around(height, cards.length)));
        });
    }

    // The height of `cards` cards `height` tall in all, with the gaps between them and the room around them.
    function around(height, cards) {
        return height + Math.max(0, cards - 1) * GAP + ROOM + ROOM_BELOW;
    }

    // The toasts' window opened `height` tall, leaving the keyboard where it is. One closed where the screen did not
    // ask opens again with the next toast.
    function open(height) {
        const opened = shell.windows.open({
            name: 'main',
            content,
            level: 'overlay',
            width: WIDTH,
            height,
            activates: false,
            didClose: () => window === opened && (window = null),
        });
        window = opened;
    }

    function drawToasts() {
        for (const id of toastCards.keys()) if (!toasts.has(id)) toastCards.delete(id);
        content.replaceChildren(...[...toasts.values()].map(({ notification }) => toastCard(notification)));
    }

    // The row the pointer or the keys are on stays on its index as rows come and go.
    function drawList() {
        const head = element('div', 'notifications-head', 'Notifications');
        shown = center.list();
        if (shown.length) head.append(button('Clear All', () => center.clear()));
        rows.set(shown);
        choice.set(
            shown.map(({ id }) => ({ element: rows.elementOf(id), disabled: false })),
            { active: Math.min(choice.active(), shown.length - 1) }
        );
        const empty = ui.emptyState({
            icon: ui.icon('bell', { size: 44 }),
            title: 'No notifications',
            hint: 'Notifications from your mods appear here.',
        }).element;
        list.replaceChildren(head, shown.length ? rows.element : empty);
    }

    // Made once per toast, coming in from the right edge, where it lives; under reduced motion it only fades in.
    function toastCard(notification) {
        const kept = toastCards.get(notification.id);
        if (kept) return kept;
        const made = card(notification, { row: false });
        toastCards.set(notification.id, made);
        const { length, fade, easing } = shell.theme.motion.enter;
        if (length)
            made.animate(
                [
                    { opacity: 0, transform: 'translateX(16px)' },
                    { opacity: 1, transform: 'none' },
                ],
                {
                    duration: length,
                    easing,
                }
            );
        else made.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade, easing });
        return made;
    }

    // A press on the card runs what it names; its close button takes a toast off the screen, and a row of the center
    // out of the record.
    function card(notification, { row }) {
        const made = element('div', 'notifications-card');
        made.dataset.deckitSolid = ''; // opaque on the panel's material: the plain inks
        made.append(...partsOf(notification, { row }));
        made.addEventListener('click', () => center.press(notification.id));
        return made;
    }

    // What a card shows: the sender's icon, the title, the body, the actions and the close button. A row tells when
    // its notification came.
    function partsOf(notification, { row }) {
        const words = element('div', 'notifications-words');
        const titleRow = element('div', 'notifications-title-row');
        titleRow.append(element('div', 'notifications-title', notification.title || notification.mod.name));
        if (row) titleRow.append(element('div', 'notifications-time', when(notification)));
        words.append(titleRow);
        if (notification.body) words.append(element('div', 'notifications-body', notification.body));
        const icon = ui.appIcon(icons.get(notification.mod.id) ?? '', { alt: notification.mod.name });
        if (notification.actions.length) {
            const actions = element('div', 'notifications-actions');
            notification.actions.forEach((action, index) =>
                actions.append(button(action.title, () => center.press(notification.id, index)))
            );
            words.append(actions);
        }
        const close = ui.iconButton({
            icon: ui.icon('x', { size: 14 }),
            title: row ? 'Remove' : 'Close',
            size: 'small',
            onClick: () => (row ? center.remove(notification.id) : hideToast(notification.id)),
        }).element;
        close.classList.add('notifications-close');
        heldBack(close);
        return [icon, words, close];
    }

    // The app icon of the mod `id` read once, and kept: '' where it has none or it is not read.
    async function iconRead(id) {
        if (!icons.has(id)) icons.set(id, await shell.mods.icon(id).catch(() => ''));
    }

    function button(label, pressed) {
        const made = ui.button({ label, size: 'small', onClick: pressed }).element;
        heldBack(made);
        return made;
    }

    // A button in a card is pressed alone, not the card around it.
    function heldBack(made) {
        for (const type of ['mousedown', 'click']) made.addEventListener(type, (event) => event.stopPropagation());
    }

    function element(tag, className, text = '') {
        const made = document.createElement(tag);
        if (className) made.className = className;
        if (text) made.textContent = text;
        return made;
    }

    return Object.freeze({ showList, toggle, end });
}

// When a notification was posted, as much as the clock beside it does not already say: the time for today, the
// weekday and time for the six days before, the date beyond, with the year when it is not this one.
const TIME = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
const WEEKDAY = new Intl.DateTimeFormat([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const DATE = new Intl.DateTimeFormat([], { month: 'short', day: 'numeric' });
const DATE_YEAR = new Intl.DateTimeFormat([], { month: 'short', day: 'numeric', year: 'numeric' });

function when(notification, now = new Date()) {
    const posted = new Date(notification.posted);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    if (posted >= today) return TIME.format(posted);
    if (posted >= weekAgo) return WEEKDAY.format(posted);
    return (posted.getFullYear() === now.getFullYear() ? DATE : DATE_YEAR).format(posted);
}

module.exports = { screen };
