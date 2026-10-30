// `refused(embedder, id, certificate)` tells deck what was refused in a web page it shows.
export function createCertificate({ refused: tell }) {
    // MARK: - Property
    // partition|host|fingerprint
    const TRUSTED = new Set();
    const refused = new Map(); // the same key -> Map(page -> the address it was loading)

    // MARK: - Initializer
    // MARK: - Public
    // A certificate the Mac cannot verify: let through where the mod handed it back as trusted, or else refused, and
    // the page's tab told, `at` being `{ embedder, tab }`. `info` is `{ url, host, error, fingerprint, subject,
    // issuer }`.
    function decide(page, at, partition, info) {
        const key = keyOf(partition, info.host, info.fingerprint);
        if (TRUSTED.has(key)) return true;
        remember(key, page, info.url);
        if (at) tell(at.embedder, at.tab.id, info);
        return false;
    }

    // What was refused under a certificate now trusted is loaded again: the page, or a window it opened.
    function trust(partition, entries) {
        for (const { host, fingerprint } of entries) {
            if (!host || !fingerprint) continue;
            const key = keyOf(partition, host, fingerprint);
            TRUSTED.add(key);
            for (const [page, url] of refused.get(key) || []) {
                if (page.isDestroyed()) continue;
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

    function remember(key, page, url) {
        if (!refused.has(key)) refused.set(key, new Map());
        if (refused.get(key).has(page)) return refused.get(key).set(page, url);
        refused.get(key).set(page, url);
        page.once('destroyed', () => {
            refused.get(key)?.delete(page);
            if (!refused.get(key)?.size) refused.delete(key);
        });
    }

    return { decide, trust };
}
