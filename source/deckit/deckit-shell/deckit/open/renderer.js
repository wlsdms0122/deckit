import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as REQUEST from '../request/index.js';
import * as OPEN_PERMISSION from './model/permission.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// MARK: - Initializer
// MARK: - Public
// `openExternal(url, options)` on the handle of `mod`: `url` handed the host to open outside the app, the app that
// opens it brought forward unless `options.activates` is false. A file URL is guarded by system.file-handlers.
// Fulfilled with nothing once main has handed it on; refused at call with UNSUPPORTED_URL by main.
function openExternalOf(mod) {
    const opensFiles = mod.permissions.some(({ id }) => id === OPEN_PERMISSION.FILE_HANDLERS);
    return (url, options) => {
        const file = typeof url === 'string' && URL.canParse(url) && new URL(url).protocol === 'file:';
        const denied =
            file && !opensFiles ? `${mod.id} does not have the ${OPEN_PERMISSION.FILE_HANDLERS} permission` : '';
        const signature = [
            ['url', 'string'],
            ['options', 'object?'],
        ];
        const open = REQUEST.requestOf('openExternal', { denied, signature }, async () => {
            const activates = options?.activates;
            const problem = REQUEST.argumentProblem([['options.activates', 'boolean?']], [activates]);
            if (problem) throw REQUEST.refusal('call', 'INVALID_ARGUMENT', `openExternal: ${problem}`);
            await PROTOCOL.open.invoke({ url, activates: activates ?? true });
        });
        return open(url, options);
    };
}

function reveal(file) {
    return PROTOCOL.reveal.invoke({ file: String(file) });
}

// Each part escaped, so a space or a # stays part of the name.
function fileURL(file) {
    const written = String(file);
    return written.startsWith('/') ? 'file://' + written.split('/').map(encodeURIComponent).join('/') : '';
}

function filePath(url) {
    try {
        const parsed = new URL(String(url));
        if (parsed.protocol !== 'file:' || (parsed.host && parsed.host !== 'localhost')) return '';
        const file = decodeURIComponent(parsed.pathname);
        return file.startsWith('/') ? file : '';
    } catch {
        return '';
    }
}

// MARK: - Private

export { openExternalOf, reveal, fileURL, filePath };
