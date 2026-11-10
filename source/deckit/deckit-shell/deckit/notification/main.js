import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from '../../../deckit-sdk/deckit/notification/protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// A platform notification, shown and its press heard: what is shown, when and for whom is the mod's that asks.
// `clicked` is the app's answer to a pressed notification, which brings it forward before the mod hears of it.
// `notifications` is the environment's.
export function createNotification({ LOG, clicked, notifications: NOTIFICATIONS }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.show.handle(({ id, title, body, silent }, sender) => show(sender, id, title, body, silent));
    }

    // MARK: - Private
    // Answers whether the system took it, its title and body handed as given: what of them fits is the system's to
    // show. One the system says it did not show is logged, and answered false.
    function show(sender, id, title, body, silent) {
        const notification = { title, body, silent };
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
