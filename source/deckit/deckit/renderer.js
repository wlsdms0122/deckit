import * as PROTOCOL from './protocol.js';
import * as IPC from '../deck/ipc/index.js';
import * as DECK from '../deck/renderer.js';
import { createPartition } from './web/model/partition.js';
import { createWeb } from './web/renderer.js';
import { createProtocol as createWebProtocol } from './web/protocol.js';
import { createNotification } from './notification/renderer.js';
import { createProtocol as createNotificationProtocol } from './notification/protocol.js';
import { createKeymap } from './keymap/renderer.js';
import { createProtocol as createKeymapProtocol } from './keymap/protocol.js';
import { createCommand } from './command/renderer.js';
import { createProtocol as createCommandProtocol } from './command/protocol.js';
import { createClipboard } from './clipboard/renderer.js';
import { createProtocol as createClipboardProtocol } from './clipboard/protocol.js';
import { createRuntime } from './runtime/renderer.js';
import { createProtocol as createRuntimeProtocol } from './runtime/protocol.js';
import { createOpen } from './open/renderer.js';
import { createProtocol as createOpenProtocol } from './open/protocol.js';
import { createMainProcess } from './main-process/renderer.js';
import { createProtocol as createMainProcessProtocol } from './main-process/protocol.js';
import { createModFolder } from './mod-folder/renderer.js';
import { createProtocol as createModFolderProtocol } from './mod-folder/protocol.js';
import { createMod } from './mod/renderer.js';

// MARK: - Public
// The entry of every page deckit makes: a mod's, or one the shell made. `before` is the set of the names the page's
// global object had before deckit's bundles ran: what they added goes, so a mod reaches deckit only through what it
// is handed. `shell` is the renderer side of the shell on deckit, if one is: `page(name)` draws a page it made, and
// `mod(context)` is what it gives each mod (mod/renderer.js). `host` is what the host app offers its own mod, handed to
// it as `deck.host`. Nothing starts off deckit's scheme: the preload runs on an error page too, which is no mod's.
function boot({ before, shell = null, host = null } = {}) {
    for (const name of Object.keys(window)) if (!before.has(name)) delete window[name];
    if (location.protocol !== DECK.SCHEME.scheme + ':') return;
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', () => start(shell, host), { once: true });
    else start(shell, host);
}

// MARK: - Private
// Deckit in the page, made of deck and its own page parts, each handed what it uses.
function start(shell, host) {
    const { page, id } = PROTOCOL.setup.invoke();
    if (page) return shell?.page(page);
    const CONFIG = Object.freeze({ id });
    const MOD = createMod({
        CONFIG,
        WEB: createWeb({ PROTOCOL: createWebProtocol({ IPC }), PARTITION: createPartition({ CONFIG }) }),
        NOTIFICATION: createNotification({ PROTOCOL: createNotificationProtocol({ IPC }) }),
        KEYMAP: createKeymap({ PROTOCOL: createKeymapProtocol({ IPC }) }),
        COMMAND: createCommand({ PROTOCOL: createCommandProtocol({ IPC }) }),
        CLIPBOARD: createClipboard({ PROTOCOL: createClipboardProtocol({ IPC }) }),
        RUNTIME: createRuntime({ PROTOCOL: createRuntimeProtocol({ IPC }) }),
        OPEN: createOpen({ PROTOCOL: createOpenProtocol({ IPC }) }),
        MAIN_PROCESS: createMainProcess({
            PROTOCOL: createMainProcessProtocol({ IPC }),
            proxyOf: DECK.proxyOf,
            deepFreeze: DECK.deepFreeze,
        }),
        MOD_FOLDER: createModFolder({ PROTOCOL: createModFolderProtocol({ IPC }) }),
        HOST: host,
        deepFreeze: DECK.deepFreeze,
    });
    DECK.createDeck().start({ layer: MOD.layerOf(shell?.mod || null) });
}

export { boot };
