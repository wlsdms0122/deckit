export function createAgent({ CONFIG, DEBUGGER, LOG }) {
    // MARK: - Property
    const HOLD = { autoAttach: true, waitForDebuggerOnStart: true, flatten: true };

    // MARK: - Initializer
    // MARK: - Public
    // A page is shown as the Chromium it really is, every frame of it alike from its first line: the app's name and
    // Electron's are taken out of its user agent, since sites treat an embedded agent as something other than a
    // browser and some sign-ins refuse it, and its client hints are the ones Chromium answers.
    // setUserAgent does not reach a cross-origin frame, which has its own process: only the DevTools protocol
    // reaches it before its first line, by holding each new frame at birth. The frame is let go whatever fails,
    // since one left waiting for a debugger stays blank.
    function presentAsBrowser(page) {
        const userAgent = browserAgent(page.getUserAgent());
        const shown = { userAgent, userAgentMetadata: browserMetadata() };
        page.setUserAgent(userAgent);
        if (!DEBUGGER.attach(page)) return;
        DEBUGGER.on(page, (method, params) => {
            if (method !== 'Target.attachedToTarget') return;
            const session = params.sessionId;
            const kind = params.targetInfo?.type;
            const dressed =
                kind === 'iframe' || kind === 'page'
                    ? DEBUGGER.send(page, 'Emulation.setUserAgentOverride', shown, session).then(() =>
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
            DEBUGGER.send(page, 'Emulation.setUserAgentOverride', shown)
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

    // The client hints Chromium answers (navigator.userAgentData, the Sec-CH-UA headers): an override without them
    // answers no brand at all, as no browser does. Its brand that names no browser, that brand's version, and which
    // of the two leads are picked from the major version, as Chromium picks them.
    function browserMetadata() {
        const full = process.versions.chrome;
        const major = Number(full.split('.')[0]);
        const MARKS = [' ', '(', ':', '-', '.', '/', ')', ';', '=', '?', '_'];
        const VERSIONS = ['8', '99', '24'];
        const none = `Not${MARKS[major % MARKS.length]}A${MARKS[(major + 1) % MARKS.length]}Brand`;
        const noneVersion = VERSIONS[major % VERSIONS.length];
        const brands = (version, nameless) => {
            const listed = [
                { brand: none, version: nameless },
                { brand: 'Chromium', version },
            ];
            return major % 2 ? listed.reverse() : listed;
        };
        const PLATFORMS = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };
        const ARCHITECTURES = { arm64: 'arm', arm: 'arm', x64: 'x86', ia32: 'x86' };
        return {
            brands: brands(String(major), noneVersion),
            fullVersionList: brands(full, `${noneVersion}.0.0.0`),
            fullVersion: full,
            platform: PLATFORMS[process.platform] || process.platform,
            platformVersion: process.getSystemVersion(),
            architecture: ARCHITECTURES[process.arch] || process.arch,
            bitness: process.arch.endsWith('64') ? '64' : '32',
            model: '',
            mobile: false,
            wow64: false,
            formFactors: ['Desktop'],
        };
    }

    return { presentAsBrowser };
}
