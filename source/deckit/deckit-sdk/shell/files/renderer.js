import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// What `dialogs.chooseFolders` takes.
const CHOOSES = Object.freeze([
    [
        'options',
        'object?',
        [
            ['multiple', 'boolean?'],
            ['title', 'string?'],
            ['message', 'string?'],
        ],
    ],
]);

// MARK: - Initializer
// MARK: - Public
// `shell.dialogs` and `shell.reveal` in a mod's page, its channels bound with `channels`, `request` making each of
// their requests as the shell's handle guards them. `dialogs.chooseFolders({ multiple, title, message })` resolves to
// the absolute paths of the folders the person chose in a dialog titled `title` and saying `message`, one unless
// `multiple`, none when they chose none. `reveal(path)` resolves to nothing once `path` is shown where it lies.
function filesOf({ channels, request }) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    return Object.freeze({
        dialogs: Object.freeze({
            chooseFolders: request(
                'dialogs.chooseFolders',
                { guard: PROTOCOL.chooseFolders.guard, signature: CHOOSES },
                (options) =>
                    PROTOCOL.chooseFolders.invoke({
                        multiple: options?.multiple ?? false,
                        title: options?.title,
                        message: options?.message,
                    })
            ),
        }),
        reveal: request('reveal', { guard: PROTOCOL.reveal.guard, signature: [['path', 'string']] }, (path) =>
            PROTOCOL.reveal.invoke({ path })
        ),
    });
}

// MARK: - Private

export { filesOf };
