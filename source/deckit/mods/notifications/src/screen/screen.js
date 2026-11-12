// The notifications on screen, in the mod's overlay window, open while it shows any: the toasts `center` lets out,
// stacked, each as tall as what it holds, which leave the keyboard where it is, and on `showList()` the record,
// newest first, to press, remove or clear, until the keyboard leaves it. A toast with actions stays until one is
// pressed or it is closed; any other leaves after a time. A press on a toast, a row or an action is the center's.
const WIDTH = 360;
const GAP = 8;
// Room around the cards in the window for the shadow they cast, deeper below, where the shadow falls.
const ROOM = 16;
const ROOM_BELOW = 24;
const LIST_HEIGHT = 440;
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
    /* The head and the empty record on a card too: the window has nothing behind its words but the desktop. */
    .notifications-head {
        align-items: center;
        justify-content: space-between;
        min-height: 44px;
        padding: 8px 8px 8px 12px;
        font: 600 var(--deckit-type-large);
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
    .notifications-close { position: absolute; top: 6px; right: 6px; }
    .notifications-empty { padding-right: 12px; flex-direction: column; gap: 2px; color: var(--deckit-muted); }
    .notifications-empty-hint { font: var(--deckit-type-small); }
`;

function screen(shell, center) {
    // MARK: - Property
    const { ui } = shell;
    const content = document.createElement('div');
    content.className = 'notifications';
    shell.ui.addStyle(STYLE);
    const toasts = new Map(); // id -> { notification, timer, leaving }
    const toastCards = new Map(); // id -> its toast's card, kept while it shows
    const icons = new Map(); // a sending mod's id -> its app icon, as the shell reads it
    let face = 'toasts';
    let window = null; // the window, while it is open
    const offs = [
        center.drawWith({ show: showToast, hide: (id) => hideToast(id, { told: false }), active: shell.active }),
        center.onChange(() => face === 'list' && draw()),
    ];

    // MARK: - Initializer
    // MARK: - Public
    async function showList() {
        await Promise.all(center.list().map((notification) => iconRead(notification.mod.id)));
        face = 'list';
        draw();
        if (!window) return open(LIST_HEIGHT);
        window.resize(WIDTH, LIST_HEIGHT);
        window.makeKeyAndOrderFront();
    }

    function end() {
        for (const off of offs) off();
        for (const { timer } of toasts.values()) clearTimeout(timer);
        toasts.clear();
    }

    // MARK: - Private
    // A toast shows once its sender's icon is read, so the default icon never stands in for it first.
    async function showToast(notification) {
        await iconRead(notification.mod.id);
        const timer = notification.actions.length ? 0 : setTimeout(() => hideToast(notification.id), STAYS);
        toasts.set(notification.id, { notification, timer });
        if (face === 'toasts') toToasts();
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
            if (face === 'toasts') toToasts();
        };
        const card = toastCards.get(id);
        if (face !== 'toasts' || !card?.isConnected) return gone();
        const { fade, easing } = shell.theme.motion;
        card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade, easing, fill: 'forwards' });
        setTimeout(gone, fade);
    }

    function toToasts() {
        face = 'toasts';
        draw();
        if (!toasts.size) {
            window?.close();
            window = null;
            return;
        }
        if (!window) open(around(toasts.size * TOAST_MOST, toasts.size), { activates: false });
        fit();
    }

    // The window as tall as the toasts it shows, once they are laid out in it.
    function fit() {
        const view = content.ownerDocument.defaultView;
        view.requestAnimationFrame(() => {
            if (face !== 'toasts' || !window || !content.isConnected) return;
            const cards = [...content.children];
            const height = cards.reduce((sum, card) => sum + card.getBoundingClientRect().height, 0);
            window.resize(WIDTH, Math.ceil(around(height, cards.length)));
        });
    }

    // The height of `cards` cards `height` tall in all, with the gaps between them and the room around them.
    function around(height, cards) {
        return height + Math.max(0, cards - 1) * GAP + ROOM + ROOM_BELOW;
    }

    // The window opened `height` tall, taking the keyboard unless `activates` is false. One closed where the screen did
    // not ask opens again with the next toast or list.
    function open(height, { activates = true } = {}) {
        const opened = shell.windows.open({
            name: 'main',
            content,
            level: 'overlay',
            width: WIDTH,
            height,
            activates,
            didResignKey: () => face === 'list' && window === opened && toToasts(),
            didClose: () => {
                if (window !== opened) return;
                window = null;
                face = 'toasts';
            },
        });
        window = opened;
    }

    function draw() {
        if (face === 'toasts') {
            for (const id of toastCards.keys()) if (!toasts.has(id)) toastCards.delete(id);
            content.replaceChildren(...[...toasts.values()].map(({ notification }) => toastCard(notification)));
            return;
        }
        const head = element('div', 'notifications-card notifications-head', 'Notifications');
        const notifications = center.list();
        if (notifications.length) head.append(button('Clear All', () => center.clear()));
        const rows = notifications.map((notification) => card(notification, { meta: true }));
        const empty = element('div', 'notifications-card notifications-empty', 'No notifications');
        empty.append(element('div', 'notifications-empty-hint', 'What mods post shows here.'));
        content.replaceChildren(head, ...(rows.length ? rows : [empty]));
    }

    // Made once per toast, coming in from the right edge, where it lives; under reduced motion it only fades in.
    function toastCard(notification) {
        const kept = toastCards.get(notification.id);
        if (kept) return kept;
        const made = card(notification, { meta: false });
        toastCards.set(notification.id, made);
        const { move, fade, easing } = shell.theme.motion;
        if (move.base)
            made.animate(
                [
                    { opacity: 0, transform: 'translateX(16px)' },
                    { opacity: 1, transform: 'none' },
                ],
                {
                    duration: move.base,
                    easing,
                }
            );
        else made.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade, easing });
        return made;
    }

    // A press on the card runs what it names; its close button takes a toast off the screen, and a row out of the
    // record.
    function card(notification, { meta }) {
        const made = element('div', 'notifications-card');
        const words = element('div', 'notifications-words');
        const titleRow = element('div', 'notifications-title-row');
        titleRow.append(element('div', 'notifications-title', notification.title || notification.mod.name));
        if (meta) titleRow.append(element('div', 'notifications-time', when(notification)));
        words.append(titleRow);
        if (notification.body) words.append(element('div', 'notifications-body', notification.body));
        made.append(ui.appIcon(icons.get(notification.mod.id) ?? '', { alt: notification.mod.name }), words);
        if (notification.actions.length) {
            const actions = element('div', 'notifications-actions');
            notification.actions.forEach((action, index) =>
                actions.append(button(action.title, () => center.press(notification.id, index)))
            );
            words.append(actions);
        }
        const close = ui.iconButton({
            icon: ui.icon('x', { size: 14 }),
            title: face === 'list' ? 'Remove' : 'Close',
            size: 'small',
            onClick: () => (face === 'list' ? center.remove(notification.id) : hideToast(notification.id)),
        }).element;
        close.classList.add('notifications-close');
        close.addEventListener('click', (event) => event.stopPropagation());
        made.append(close);
        made.addEventListener('click', () => center.press(notification.id));
        return made;
    }

    // The app icon of the mod `id` read once, and kept: '' where it has none or it is not read.
    async function iconRead(id) {
        if (!icons.has(id)) icons.set(id, await shell.mods.icon(id).catch(() => ''));
    }

    function button(label, pressed) {
        const made = ui.button({ label, size: 'small', onClick: pressed }).element;
        made.addEventListener('click', (event) => event.stopPropagation());
        return made;
    }

    function element(tag, className, text = '') {
        const made = document.createElement(tag);
        if (className) made.className = className;
        if (text) made.textContent = text;
        return made;
    }

    return Object.freeze({ showList, end });
}

function when(notification) {
    return new Date(notification.posted).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

module.exports = { screen };
