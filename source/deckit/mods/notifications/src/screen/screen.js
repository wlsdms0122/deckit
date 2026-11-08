// The notifications on screen, in the mod's overlay window, open while it shows any: the toasts `center` lets out,
// stacked and each gone after a time, which leave the keyboard where it is, and on `showList()` the record, newest
// first, to press, remove or clear, until the keyboard leaves it. A press on a toast, a row or an action is the
// center's.
const WIDTH = 360;
const TOAST_HEIGHT = 76;
const GAP = 8;
const LIST_HEIGHT = 440;
// How long a toast stays.
const STAYS = 6000;

const STYLE = `
    .notifications { font: var(--deckit-text-size, 13px) / 1.35 var(--deckit-text-font, system-ui); color: inherit;
        display: flex; flex-direction: column; gap: ${GAP}px; padding: ${GAP}px; box-sizing: border-box;
        overflow-y: auto; height: 100%; }
    .notifications-head { display: flex; align-items: center; justify-content: space-between; font-weight: 600; }
    .notifications-card { position: relative; display: flex; flex-direction: column; gap: 2px; padding: 10px 28px 10px
        12px; border-radius: 10px; border: 1px solid var(--deckit-border, rgba(127, 127, 127, 0.3)); cursor: default;
        flex: 0 0 auto; box-sizing: border-box; }
    .notifications-toast { height: ${TOAST_HEIGHT}px; overflow: hidden; }
    .notifications-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .notifications-body { color: var(--deckit-muted, inherit); overflow: hidden; text-overflow: ellipsis;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .notifications-meta { color: var(--deckit-muted, inherit); font-size: 11px; }
    .notifications-actions { display: flex; gap: 6px; margin-top: 4px; }
    .notifications-close { position: absolute; top: 6px; right: 6px; border: 0; background: none; color: inherit;
        opacity: 0.6; cursor: default; }
    .notifications-empty { color: var(--deckit-muted, inherit); text-align: center; margin-top: 24px; }
`;

function screen(shell, center) {
    // MARK: - Property
    const content = document.createElement('div');
    content.className = 'notifications';
    shell.ui.addStyle(STYLE);
    const toasts = new Map(); // id -> { notification, timer }
    let face = 'toasts';
    let window = null; // the window, while it is open
    const offs = [
        center.drawWith({ show: showToast, hide: (id) => hideToast(id, { told: false }) }),
        center.onChange(() => face === 'list' && draw()),
    ];

    // MARK: - Initializer
    // MARK: - Public
    function showList() {
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
    function showToast(notification) {
        const timer = setTimeout(() => hideToast(notification.id), STAYS);
        toasts.set(notification.id, { notification, timer });
        if (face === 'toasts') toToasts();
    }

    // `told`: the center is told the toast is gone, unless it is the one that took it away.
    function hideToast(id, { told = true } = {}) {
        const toast = toasts.get(id);
        if (!toast) return;
        clearTimeout(toast.timer);
        toasts.delete(id);
        if (told) center.toastGone(id);
        if (face === 'toasts') toToasts();
    }

    function toToasts() {
        face = 'toasts';
        draw();
        if (!toasts.size) {
            window?.close();
            window = null;
            return;
        }
        if (window) window.resize(WIDTH, heightOf(toasts.size));
        else open(heightOf(toasts.size), { activates: false });
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
            content.replaceChildren(...[...toasts.values()].map(({ notification }) => toastCard(notification)));
            return;
        }
        const head = element('div', 'notifications-head', 'Notifications');
        const notifications = center.list();
        if (notifications.length) head.append(button('Clear', () => center.clear()));
        const rows = notifications.map((notification) => card(notification, { meta: true }));
        const empty = notifications.length ? [] : [element('div', 'notifications-empty', 'No notifications')];
        content.replaceChildren(head, ...rows, ...empty);
    }

    function toastCard(notification) {
        const made = card(notification, { meta: false });
        made.classList.add('notifications-toast');
        return made;
    }

    // A press on the card runs what it names; its close button takes a toast off the screen, and a row out of the record.
    function card(notification, { meta }) {
        const made = element('div', 'notifications-card');
        if (notification.title) made.append(element('div', 'notifications-title', notification.title));
        if (notification.body) made.append(element('div', 'notifications-body', notification.body));
        if (meta) made.append(element('div', 'notifications-meta', `${notification.mod.name} · ${when(notification)}`));
        if (notification.actions.length) {
            const actions = element('div', 'notifications-actions');
            notification.actions.forEach((action, index) =>
                actions.append(button(action.title, () => center.press(notification.id, index)))
            );
            made.append(actions);
        }
        const close = button('×', () =>
            face === 'list' ? center.remove(notification.id) : hideToast(notification.id)
        );
        close.className = 'notifications-close';
        close.title = face === 'list' ? 'Remove' : 'Close';
        made.append(close);
        made.addEventListener('click', () => center.press(notification.id));
        return made;
    }

    function button(text, pressed) {
        const made = element('button', '', text);
        made.addEventListener('click', (event) => {
            event.stopPropagation();
            pressed();
        });
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

function heightOf(count) {
    return count * TOAST_HEIGHT + (count + 1) * GAP;
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
