// The downloads web pages start, each written to `folder()` under the name the site gives it, made unique there.
// What becomes of one is told to the `tell(download)` it started with, at each change, from the moment it has a file:
// `{ id, url, name, path, state, received, expected, error }`, `id` the module's, `state` one of `downloading`,
// `finished`, `failed` or `cancelled`, and `expected` -1 while it is not known.
export function createDownload({ folder }) {
    // MARK: - Property
    const path = require('path');
    const fs = require('fs');
    const writing = new Set(); // the files of the downloads under way

    // MARK: - Initializer
    // MARK: - Public
    // The listener of a download the module started at `url` (deckit-web WebDownload).
    function listenerFor(url, tell) {
        const download = {
            id: null,
            url: String(url),
            name: '',
            path: '',
            state: 'downloading',
            received: 0,
            expected: -1,
            error: '',
        };
        const told = () => download.path && tell({ ...download });
        return (event, payload) => {
            switch (event) {
                case 'adopted':
                    download.id = payload.id;
                    return undefined;
                case 'destination':
                    download.url = payload.url || download.url;
                    download.path = freePath(payload.suggestedFilename);
                    download.name = path.basename(download.path);
                    download.expected = payload.expectedLength;
                    writing.add(download.path);
                    told();
                    return download.path;
                case 'progress':
                    download.received = payload.received;
                    download.expected = payload.expected;
                    return void told();
                case 'finished':
                    writing.delete(download.path);
                    download.state = 'finished';
                    return void told();
                case 'failed':
                    writing.delete(download.path);
                    download.state = payload.cancelled ? 'cancelled' : 'failed';
                    download.error = payload.cancelled ? '' : String(payload.description || '');
                    return void told();
                default:
                    return undefined;
            }
        };
    }

    // MARK: - Private
    // `name`, or `name (2)`, `name (3)` and on, before its extension, whichever is neither a file nor one being written.
    function freePath(suggested) {
        const name = path.basename(String(suggested || '')).replace(/^\.+/, '') || 'download';
        const extension = path.extname(name);
        const stem = name.slice(0, name.length - extension.length);
        const directory = folder();
        for (let count = 1; ; count++) {
            const candidate = path.join(directory, count === 1 ? name : `${stem} (${count})${extension}`);
            if (!writing.has(candidate) && !fs.existsSync(candidate)) return candidate;
        }
    }

    return { listenerFor };
}
