const { hostOf, originOf, isWeb } = require('./address.js');
const { grantKey } = require('./store.js');

// The questions a site makes the Browser ask: a certificate this Mac cannot verify, a permission, an app to open. And
// the site permissions the person reviews. While the Browser is hidden a request waits until its tab is next in front;
// a background tab that asks while the Browser is on screen is brought to the front.
function prompts({ ui, webSession, certificates, grants, isShown, listTabs, onAsk }) {
    const PERMISSION_WORDS = {
        microphone: 'your microphone',
        camera: 'your camera',
        notifications: 'notifications',
    };
    const PERMISSION_LABELS = { microphone: 'Microphone', camera: 'Camera', notifications: 'Notifications' };

    // A refused load reports on every retry, so each certificate is asked once per attempt.
    const askedCertificates = new Set();
    const pending = new WeakMap(); // tab -> permission requests waiting for the Browser to be on screen
    const refused = new WeakMap(); // tab -> the grant keys refused, for as long as the tab lasts

    return {
        askCertificate,
        askPermission,
        askPending,
        release,
        editSitePermissions,
        clearAskedCertificates: () => askedCertificates.clear(),
    };

    // The main process shows no interstitial for an unverifiable certificate, only a refusal: this dialog is it.
    function askCertificate(info) {
        if (!info || !info.host || !info.fingerprint) return;
        const key = info.host + '|' + info.fingerprint;
        if (askedCertificates.has(key)) return;
        askedCertificates.add(key);
        ui.dialog({
            title: 'Certificate cannot be verified',
            message:
                `${info.host} is served with a certificate issued by "${info.issuer || 'an unknown authority'}", ` +
                `which this machine does not trust (${info.error}). Internal sites signed by a private CA look ` +
                `exactly like this, and so does someone sitting in the middle of the connection.`,
            confirmLabel: 'Trust and reload',
            destructive: true,
            onConfirm: async () => {
                const entry = certificates.add(info.host, info.fingerprint);
                // The main process reloads what was refused, which may be a window this tab opened.
                await webSession.trust([entry]);
                askedCertificates.delete(key);
            },
        });
    }

    // Whether the page of `tab` may have what `request` asks for.
    function askPermission(tab, request) {
        return new Promise((answer) => decide(tab, { ...request, answer }));
    }

    function askPending(tab) {
        if (!isShown()) return;
        const requests = pending.get(tab) || [];
        pending.delete(tab);
        for (const request of requests) decide(tab, request);
    }

    // The page of `tab` is gone: what it still waits on is refused.
    function release(tab) {
        for (const request of pending.get(tab) || []) request.answer(false);
        pending.delete(tab);
    }

    function editSitePermissions(url) {
        if (!isWeb(url)) return;
        const origin = originOf(url);
        const had = new Set(grants.of(origin).map((grant) => grant.permission));
        const kinds = [...Object.keys(PERMISSION_WORDS), ...[...had].filter(opensApp)];
        ui.dialog({
            title: `Permissions for ${hostOf(origin) || origin}`,
            message: 'Off, and the site asks the next time it wants it.',
            fields: kinds.map((kind) => ({ key: kind, type: 'switch', label: labelOf(kind), value: had.has(kind) })),
            onConfirm: async (values) => {
                const added = kinds
                    .filter((kind) => values[kind] && !had.has(kind))
                    .map((permission) => ({ origin, permission }));
                const removed = kinds
                    .filter((kind) => !values[kind] && had.has(kind))
                    .map((permission) => ({ origin, permission }));
                if (added.length) {
                    grants.add(added);
                    for (const tab of listTabs()) for (const grant of added) refused.get(tab)?.delete(grantKey(grant));
                    await webSession.allow(added);
                }
                if (removed.length) {
                    grants.remove(removed);
                    await webSession.revoke(removed);
                    // A page keeps a stream it already has and still believes it granted, so revoking reloads its
                    // tabs. An app's permission is asked at each opening and needs no reload.
                    if (removed.some((grant) => !opensApp(grant.permission)))
                        for (const tab of listTabs()) if (originOf(tab.url) === origin) tab.page.reload();
                }
            },
        });
    }

    function decide(tab, request) {
        const wanted = request.permissions.filter((permission) => PERMISSION_WORDS[permission] || opensApp(permission));
        const refusals = refusalsOf(tab);
        if (
            !wanted.length ||
            wanted.some((permission) => refusals.has(grantKey({ origin: request.origin, permission })))
        )
            return request.answer(false);
        if (!isShown()) {
            pending.set(tab, [...(pending.get(tab) || []), request]);
            return;
        }
        onAsk(tab);
        if (wanted.some(opensApp)) return askOpen(tab, request, wanted);
        let allowed = false;
        ui.dialog({
            title: `${hostOf(request.origin) || request.origin} wants to use ${spokenList(wanted.map((permission) => PERMISSION_WORDS[permission]))}`,
            message: 'Allowed, it is remembered for this site. Blocked, it stays blocked until this tab is closed.',
            confirmLabel: 'Allow',
            cancelLabel: 'Block',
            // Kept, here and in the main process, before the page hears yes: what it does next asks it again.
            onConfirm: () => {
                allowed = true;
                const kept = wanted.map((permission) => ({ origin: request.origin, permission }));
                grants.add(kept);
                webSession
                    .allow(kept)
                    .catch(() => {})
                    .then(() => request.answer(true));
            },
            // Runs before onConfirm, so the answer waits a turn to see whether it was a yes.
            onClose: () =>
                queueMicrotask(() => {
                    if (allowed) return;
                    for (const permission of wanted) refusals.add(grantKey({ origin: request.origin, permission }));
                    request.answer(false);
                }),
        });
    }

    function askOpen(tab, request, wanted) {
        const app = request.app || 'an app';
        const site = hostOf(request.origin) || request.origin;
        let opened = false;
        ui.dialog({
            title: `Open ${app}?`,
            message: `${site} wants to open ${app} on this Mac.`,
            fields: [{ key: 'always', type: 'switch', label: `Always allow ${site} to open ${app}`, value: false }],
            confirmLabel: `Open ${app}`,
            cancelLabel: 'Cancel',
            onConfirm: ({ always }) => {
                opened = true;
                const kept = always ? wanted.map((permission) => ({ origin: request.origin, permission })) : [];
                if (kept.length) grants.add(kept);
                (kept.length ? webSession.allow(kept).catch(() => {}) : Promise.resolve()).then(() =>
                    request.answer(true)
                );
            },
            onClose: () =>
                queueMicrotask(() => {
                    if (opened) return;
                    for (const permission of wanted)
                        refusalsOf(tab).add(grantKey({ origin: request.origin, permission }));
                    request.answer(false);
                }),
        });
    }

    function refusalsOf(tab) {
        if (!refused.has(tab)) refused.set(tab, new Set());
        return refused.get(tab);
    }

    // A permission "open:<scheme>" opens the app for that kind of address, and is asked per app.
    function opensApp(permission) {
        return permission.startsWith('open:');
    }

    function labelOf(permission) {
        return opensApp(permission)
            ? `Open “${permission.slice(5)}” links in their app`
            : PERMISSION_LABELS[permission];
    }

    // "a", "a and b", "a, b and c".
    function spokenList(words) {
        return words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] : words[0] || '';
    }
}

module.exports = { prompts };
