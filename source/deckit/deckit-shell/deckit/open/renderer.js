import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as REQUEST from '../request/index.js';
import * as OPEN_PERMISSION from './model/permission.js';
import * as FILE_URL from './model/file-url.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// MARK: - Initializer
// MARK: - Public
// `openExternal(url, options)` on the handle of `mod`, which is granted `granted`: `url` handed the host to open
// outside the app, the app that opens it brought forward unless `options.activates` is false. A file URL is guarded
// by system.file-handlers. Fulfilled with nothing once main has handed it on; refused at call with UNSUPPORTED_URL by
// main.
function openExternalOf(mod, granted) {
    const opensFiles = granted.includes(OPEN_PERMISSION.FILE_HANDLERS);
    return (url, options) => {
        const file = typeof url === 'string' && URL.canParse(url) && new URL(url).protocol === 'file:';
        const denied =
            file && !opensFiles ? `${mod.id} does not have the ${OPEN_PERMISSION.FILE_HANDLERS} permission` : '';
        const signature = [
            ['url', 'string'],
            ['options', 'object?', [['activates', 'boolean?']]],
        ];
        const open = REQUEST.requestOf('openExternal', { denied, signature }, () =>
            PROTOCOL.open.invoke({ url, activates: options?.activates ?? true })
        );
        return open(url, options);
    };
}

// `path` shown in its folder.
function reveal(path) {
    return PROTOCOL.reveal.invoke({ file: path });
}

function fileURL(path) {
    refuseArguments('fileURL', [['path', 'string']], [path]);
    return FILE_URL.fileURL(path);
}

function filePath(url) {
    refuseArguments('filePath', [['url', 'string']], [url]);
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'file:' || parsed.host) return '';
        const file = decodeURIComponent(parsed.pathname);
        return file.startsWith('/') ? file : '';
    } catch {
        return '';
    }
}

// MARK: - Private
// fileURL and filePath answer at once, not with a promise, so they throw the refusal a request rejects with.
function refuseArguments(name, signature, args) {
    const problem = REQUEST.argumentProblem(signature, args);
    if (problem) throw REQUEST.refusal('call', 'INVALID_ARGUMENT', `${name}: ${problem}`);
}

export { openExternalOf, reveal, fileURL, filePath };
