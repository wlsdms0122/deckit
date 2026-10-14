export function createAgent({ CONFIG, DEBUGGER, LOG }) {
    // MARK: - Property
    const HOLD = { autoAttach: true, waitForDebuggerOnStart: true, flatten: true };

    // MARK: - Initializer
    // MARK: - Public
    // A page is given the user agent of the Chrome it really is: the app's name and Electron's are taken out of
    // it, since sites treat an embedded agent as something other than a browser and some sign-ins refuse it.
    // setUserAgent does not reach a cross-origin frame, which has its own process: only the DevTools protocol
    // reaches it before its first line, by holding each new frame at birth. The frame is let go whatever fails,
    // since one left waiting for a debugger stays blank.
    function presentAsBrowser(page) {
        const userAgent = browserAgent(page.getUserAgent());
        page.setUserAgent(userAgent);
        if (!DEBUGGER.attach(page)) return;
        DEBUGGER.on(page, (method, params) => {
            if (method !== 'Target.attachedToTarget') return;
            const session = params.sessionId;
            const kind = params.targetInfo?.type;
            const dressed =
                kind === 'iframe' || kind === 'page'
                    ? DEBUGGER.send(page, 'Emulation.setUserAgentOverride', { userAgent }, session).then(() =>
                          DEBUGGER.send(page, 'Target.setAutoAttach', HOLD, session)
                      )
                    : Promise.resolve();
            dressed
                .catch(() => {})
                .then(
                    () =>
                        params.waitingForDebugger && DEBUGGER.send(page, 'Runtime.runIfWaitingForDebugger', {}, session)
                )
                .catch(() => {});
        });
        // On the page itself too: a window handed over already loading is too late for setUserAgent. A page not
        // yet loading has no target, so this waits for it.
        const arm = () =>
            DEBUGGER.send(page, 'Emulation.setUserAgentOverride', { userAgent })
                .then(() => DEBUGGER.send(page, 'Target.setAutoAttach', HOLD))
                .catch((error) => LOG.error('could not hand frames the browser agent', error));
        if (page.getURL() || page.isLoading()) arm();
        else page.once('did-start-loading', arm);
    }

    // MARK: - Private
    // A name with its version ("Electron/44.3.0") or on its own, as a whole token.
    function browserAgent(agent) {
        const { app } = require('electron');
        const names = [app.getName(), 'Electron', ...CONFIG.agent].map((name) =>
            name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );
        return String(agent)
            .replace(new RegExp(`\\s*\\b(?:${names.join('|')})(?:/\\S+)?(?=\\s|$)`, 'g'), '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    return { presentAsBrowser };
}
