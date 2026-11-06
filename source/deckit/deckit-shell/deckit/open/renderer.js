import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// MARK: - Initializer
// MARK: - Public
// An address opened with the system, brought forward unless `activates` is false. Answers whether it opened.
function open(url, { activates = true } = {}) {
    return PROTOCOL.open.invoke({ url: String(url), activates: activates !== false });
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

export { open, reveal, fileURL, filePath };
