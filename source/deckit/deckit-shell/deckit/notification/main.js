import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from '../../../deckit-sdk/deckit/notification/protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// A platform notification, shown and its press heard: what is shown, when and for whom is the mod's that asks.
// `clicked` is the app's answer to a pressed notification, which brings it forward before the mod hears of it.
// `notifications` is the environment's.
export function createNotification({ LOG, clicked, notifications: NOTIFICATIONS }) {
    // MARK: - Property
    const TITLE_LIMIT = 200;
    const BODY_LIMIT = 400;

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.show.handle(({ id, title, body, silent }, sender) => show(sender, id, title, body, silent));
    }

    // MARK: - Private
    // Answers whether it was shown; one the system says it did not show is logged.
    function show(sender, id, title, body, silent) {
        const notification = { title: title.slice(0, TITLE_LIMIT), body: body.slice(0, BODY_LIMIT), silent };
        const onClick = () => {
            clicked();
            PROTOCOL.pressed.send(sender, { id });
        };
        return NOTIFICATIONS.show(notification, { onClick }).catch((error) => {
            LOG.warn('a notification was not shown', error?.message || '');
            return false;
        });
    }

    return { start };
}
