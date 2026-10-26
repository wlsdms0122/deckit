export function createAgent({ CONFIG, DEBUGGER, LOG }) {
    // MARK: - Property
    const HOLD = { autoAttach: true, waitForDebuggerOnStart: true, flatten: true };
    // Sites that refuse the browser this is, by domain with its subdomains, and the agent each is shown instead.
    // Google's sign-in takes a Chromium that is not Chrome itself for an embedded browser and refuses it, whatever it
    // says it is, and takes Firefox; Google's pages are all shown Firefox, from their first request, for a session
    // they saw as another browser is refused sign-in too.
    const SITE_AGENTS = { 'google.com': firefoxAgent() };
    const SITE_OVERRIDES = Object.fromEntries(
        Object.entries(SITE_AGENTS).map(([domain, userAgent]) => [domain, { userAgent }])
    );
    // The addresses of those sites, as a session's web requests are filtered by.
    const SITE_URLS = Object.keys(SITE_AGENTS).flatMap((domain) => [`*://${domain}/*`, `*://*.${domain}/*`]);

    // MARK: - Initializer
    // MARK: - Public
    // A page is given the user agent of the Chrome it really is: the app's name and Electron's are taken out of
    // it, since sites treat an embedded agent as something other than a browser and some sign-ins refuse it.
    // setUserAgent does not reach a cross-origin frame, which has its own process: only the DevTools protocol
    // reaches it before its first line, by holding each new frame at birth. The frame is let go whatever fails,
    // since one left waiting for a debugger stays blank.
    function presentAsBrowser(page) {
        const userAgent = browserAgent(page.getUserAgent());
        const browser = { userAgent, userAgentMetadata: browserMetadata() };
        const overrideFor = (url) => SITE_OVERRIDES[siteOf(hostOf(url))] || browser;
        let override = overrideFor(page.getURL()); // what the page is to be shown
        let sent = null; // what it was last given; null until it is armed
        let sending = false;
        page.setUserAgent(userAgent);
        if (!DEBUGGER.attach(page)) return;
        DEBUGGER.on(page, (method, params) => {
            if (method !== 'Target.attachedToTarget') return;
            const session = params.sessionId;
            const kind = params.targetInfo?.type;
            // A frame is shown what its own site is, as its requests are; one with no address yet, what its page is.
            const url = params.targetInfo?.url;
            const shown = /^https?:/i.test(url || '') ? overrideFor(url) : override;
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
        // Gives the page what it is to be shown, once it is armed, one change at a time: one made while another is
        // on its way is sent after it.
        const apply = () => {
            if (sent === null || sending || sent === override) return;
            const given = override;
            sending = true;
            DEBUGGER.send(page, 'Emulation.setUserAgentOverride', given)
                .catch((error) => LOG.error('could not hand a page the agent of the site it is on', error))
                .then(() => {
                    sent = given;
                    sending = false;
                    apply();
                });
        };
        // On the page itself too: a window handed over already loading is too late for setUserAgent. A page not
        // yet loading has no target, so this waits for it.
        const arm = () => {
            const given = override;
            DEBUGGER.send(page, 'Emulation.setUserAgentOverride', given)
                .then(() => (sent = given))
                .then(() => DEBUGGER.send(page, 'Target.setAutoAttach', HOLD))
                .then(apply)
                .catch((error) => LOG.error('could not hand frames the browser agent', error));
        };
        if (page.getURL() || page.isLoading()) arm();
        else page.once('did-start-loading', arm);
        // A page going to a site with an agent of its own is shown it from the start of the navigation, and the
        // browser's again once it leaves. A navigation that never lands, cancelled or failed, leaves the page shown
        // what its address is once it stops loading.
        const follow = (details) => {
            if (!details.isMainFrame) return;
            override = overrideFor(details.url);
            apply();
        };
        LOG.guard(page, 'did-start-navigation', follow);
        LOG.guard(page, 'did-redirect-navigation', follow);
        LOG.guard(page, 'did-stop-loading', () => {
            override = overrideFor(page.getURL());
            apply();
        });
    }

    // A request to a site with an agent of its own goes with that agent, and without the client hints Chrome sends and
    // the browser it is shown as does not. Others go as they are.
    function requestHeaders(url, headers) {
        const domain = siteOf(hostOf(url));
        if (!domain) return headers;
        const sent = {};
        for (const [key, value] of Object.entries(headers))
            if (!/^(sec-ch-ua|user-agent$)/i.test(key)) sent[key] = value;
        sent['User-Agent'] = SITE_AGENTS[domain];
        return sent;
    }

    // MARK: - Private
    // The domain in SITE_AGENTS a host is or is under, or null.
    function siteOf(host) {
        return Object.keys(SITE_AGENTS).find((domain) => host === domain || host.endsWith('.' + domain)) || null;
    }

    function hostOf(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return '';
        }
    }

    // Firefox on this system, a release as recent as the Chrome this is: Firefox, as Chrome, ships a major release
    // every four weeks, two numbers ahead.
    function firefoxAgent() {
        const version = `${Number(process.versions.chrome.split('.')[0]) + 2}.0`;
        const SYSTEMS = {
            darwin: 'Macintosh; Intel Mac OS X 10.15',
            win32: 'Windows NT 10.0; Win64; x64',
            linux: 'X11; Linux x86_64',
        };
        const system = SYSTEMS[process.platform] || SYSTEMS.linux;
        return `Mozilla/5.0 (${system}; rv:${version}) Gecko/20100101 Firefox/${version}`;
    }

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

    // The client hints the agent answers (navigator.userAgentData, the Sec-CH-UA headers), as the browser it is
    // answers them: an override without them answers no brand at all, as no browser does.
    function browserMetadata() {
        const full = process.versions.chrome;
        const major = full.split('.')[0];
        const brands = (version, grease) => [
            { brand: 'Chromium', version },
            { brand: 'Not_A Brand', version: grease },
        ];
        const PLATFORMS = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };
        const ARCHITECTURES = { arm64: 'arm', arm: 'arm', x64: 'x86', ia32: 'x86' };
        return {
            brands: brands(major, '99'),
            fullVersionList: brands(full, '99.0.0.0'),
            fullVersion: full,
            platform: PLATFORMS[process.platform] || process.platform,
            platformVersion: process.getSystemVersion(),
            architecture: ARCHITECTURES[process.arch] || process.arch,
            bitness: process.arch.endsWith('64') ? '64' : '32',
            model: '',
            mobile: false,
            wow64: false,
        };
    }

    return { presentAsBrowser, requestHeaders, SITE_URLS };
}
