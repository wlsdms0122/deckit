import * as CHANNEL from '../../deckit-shell/deck/channel/index.js';
import * as IPC from '../../deckit-shell/deck/ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createCertificate({ LOG, SESSION, REGISTRY }) {
    // MARK: - Property
    // partition|host|fingerprint
    const TRUSTED = new Set();
    const refused = new Map(); // the same key -> Map(page id -> the address it was loading)

    // MARK: - Initializer
    // MARK: - Public
    // Electron shows no interstitial, only a failed load. A certificate the Mac cannot verify is refused, the
    // page's tab is told, and the mod hands back what it accepts. The event is the app's, and deckit answers
    // it only for its own pages.
    function start() {
        LOG.guard(require('electron').app, 'certificate-error', (event, page, url, error, certificate, callback) => {
            const at = REGISTRY.tabOf(page);
            if (!at) return;
            const partition = SESSION.partitionOf(page);
            const host = hostOf(url);
            const key = keyOf(partition, host, certificate.fingerprint);
            event.preventDefault();
            if (TRUSTED.has(key)) {
                callback(true);
                return;
            }
            callback(false);
            remember(key, page, url);
            PROTOCOL.refused.send(at.embedder, {
                id: at.tab.id,
                certificate: {
                    url,
                    host,
                    error,
                    fingerprint: certificate.fingerprint,
                    subject: certificate.subjectName,
                    issuer: certificate.issuerName,
                },
            });
        });
    }

    // What was refused under a certificate now trusted is loaded again: the page, or a window it opened.
    function trust(partition, entries) {
        const { webContents } = require('electron');
        for (const { host, fingerprint } of entries) {
            if (!host || !fingerprint) continue;
            const key = keyOf(partition, host, fingerprint);
            TRUSTED.add(key);
            for (const [id, url] of refused.get(key) || []) {
                const page = webContents.fromId(id);
                if (!page) continue;
                // A page that never got past the refusal has nothing to reload.
                const at = page.getURL();
                if (!at || at === 'about:blank') page.loadURL(url);
                else page.reload();
            }
            refused.delete(key);
        }
        return TRUSTED.size;
    }

    // MARK: - Private
    function keyOf(partition, host, fingerprint) {
        return `${partition}|${host}|${fingerprint}`;
    }

    function hostOf(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return '';
        }
    }

    function remember(key, page, url) {
        if (!refused.has(key)) refused.set(key, new Map());
        refused.get(key).set(page.id, url);
        page.once('destroyed', () => {
            refused.get(key)?.delete(page.id);
            if (!refused.get(key)?.size) refused.delete(key);
        });
    }

    return { start, trust };
}
