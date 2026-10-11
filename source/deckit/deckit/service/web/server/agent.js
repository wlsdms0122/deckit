DeckitModule.define(
    'deckit/service/web/server/agent',
    {
        uses: [],
        provides: ['presentAsBrowser', 'hideFromAgent'],
    },
    () => {
        const { app } = require('electron');

        /* Sites believe the agent: claude.ai takes an Electron agent for its own desktop app, and Google's
     sign-in refuses embedded ones. Without these names it is the Chrome it really is. */
        const notBrowser = new Set([app.getName(), 'Electron']);
        const browserUserAgent = (ua) => {
            const names = [...notBrowser].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            // A name with its version ("Electron/44.3.0") or on its own ("AppleSilicon"), as a whole token.
            return String(ua || '')
                .replace(new RegExp(`\\s*\\b(?:${names})(?:/\\S+)?(?=\\s|$)`, 'g'), '')
                .replace(/\s{2,}/g, ' ')
                .trim();
        };

        /* setUserAgent does not reach a cross-origin frame's navigator: that frame has its own process,
     with the app's agent (a sign-in widget or a captcha reads it there). Only the DevTools protocol
     reaches it before its first line: auto-attach holds each new frame at birth to dress it. The
     frame is resumed whatever fails, since one left waiting for a debugger stays blank. */
        const presentAsBrowser = (wc) => {
            const userAgent = browserUserAgent(wc.getUserAgent());
            wc.setUserAgent(userAgent);
            const dbg = wc.debugger;
            const hold = { autoAttach: true, waitForDebuggerOnStart: true, flatten: true };
            const send = (method, params, session) => dbg.sendCommand(method, params, session);
            try {
                if (!dbg.isAttached()) dbg.attach('1.3');
            } catch (e) {
                console.error("[deckit] no debugger for the browser agent; frames keep the app's", e);
                return;
            }
            dbg.on('message', (_e, method, params) => {
                if (method !== 'Target.attachedToTarget') return;
                const session = params.sessionId;
                const kind = params.targetInfo && params.targetInfo.type;
                const dress =
                    kind === 'iframe' || kind === 'page'
                        ? send('Emulation.setUserAgentOverride', { userAgent }, session).then(() =>
                              send('Target.setAutoAttach', hold, session)
                          )
                        : Promise.resolve();
                dress
                    .catch(() => {})
                    .then(() => params.waitingForDebugger && send('Runtime.runIfWaitingForDebugger', {}, session))
                    .catch(() => {});
            });
            /* On the page itself too: a sign-in window is already loading when handed over, so setUserAgent
       is late for its first document. A webContents not yet loading has no target, so this waits. */
            const arm = () =>
                send('Emulation.setUserAgentOverride', { userAgent })
                    .then(() => send('Target.setAutoAttach', hold))
                    .catch((e) => console.error('[deckit] could not hand frames the browser agent', e));
            if (wc.getURL() || wc.isLoading()) arm();
            else wc.once('did-start-loading', arm);
        };

        return {
            presentAsBrowser,
            hideFromAgent: (names) => {
                for (const n of [].concat(names || [])) if (n) notBrowser.add(String(n));
            },
        };
    }
);
