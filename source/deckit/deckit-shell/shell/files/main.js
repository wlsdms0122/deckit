import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DECLARED from '../../../deckit-sdk/shell/files/protocol.js';

// The person's files shown to them outside the app, for any mod's page: the folders they choose in a dialog, and a path
// shown where it lies. `deckit` is what connect answered, `dialogs` and `reveal` the environment's (environment:
// SHELL.dialogs, SHELL.reveal).
export function createFiles({ deckit, dialogs: DIALOGS, reveal: REVEAL }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.chooseFolders.handle(({ multiple, title, message }, sender) => {
            deckit.mods.modFrom(sender);
            return DIALOGS.chooseFolders({ title, buttonLabel: 'Choose', message, multiple });
        });
        PROTOCOL.reveal.handle(({ path }, sender) => {
            deckit.mods.modFrom(sender);
            REVEAL(path);
        });
    }

    // MARK: - Private

    return { start };
}
