DeckitModule.define(
    'deckit/feature/window/main',
    {
        uses: [
            'deckit/service/home/model/config',
            'deckit/module/log',
            'deckit/service/storage',
            'deckit/feature/window/main/bar',
        ],
        provides: ['open', 'get', 'close', 'raise', 'has', 'place', 'dress', 'LIGHTS_AT', 'FALLBACK_BG'],
    },
    (CONFIG, log, storage, BAR) => {
        const { BrowserWindow, screen } = require('electron');

        const store = storage.host;
        // A throw in a main-process listener quits the app, so every listener here goes through guard.
        const { guard } = log;

        const DEFAULT_SIZE = { width: 1100, height: 760 };
        const FALLBACK_BG = '#1a1d21';

        // key -> { win, view, boundsKey, afterDetach, detached }
        const open = new Map();

        const placed = new WeakMap(); // view -> { win, bounds, onClose }
        const inWindow = new WeakMap(); // window -> Set of the views placed in it
        const size = (view) => {
            const at = placed.get(view);
            if (!at || at.win.isDestroyed()) return;
            if (at.bounds) {
                view.setBounds(at.bounds);
                return;
            }
            const [width, height] = at.win.getContentSize();
            view.setBounds({ x: 0, y: 0, width, height });
        };
        const unplace = (view) => {
            const at = placed.get(view);
            if (!at) return;
            placed.delete(view);
            inWindow.get(at.win)?.delete(view);
            try {
                if (!at.win.isDestroyed()) at.win.contentView.removeChildView(view);
            } catch {}
        };
        /* A closing window destroys every view still in it, and touching a destroyed webContents in main
     throws. So views are taken out on `close`, not `closed`. */
        const follow = (win) => {
            if (inWindow.has(win)) return;
            inWindow.set(win, new Set());
            guard(win, 'resize', () => {
                for (const view of inWindow.get(win) || []) size(view);
            });
            guard(win, 'close', () => {
                for (const view of [...(inWindow.get(win) || [])]) {
                    const { onClose } = placed.get(view) || {};
                    unplace(view);
                    try {
                        onClose?.(view);
                    } catch (e) {
                        console.error("[deckit] a placed view's onClose", e);
                    }
                }
            });
        };

        // Without `front`, a view already in the window is not re-added: that would lift it over the bar or a view put above it since.
        const place = (view, win, { bounds = null, front = false, onClose = null } = {}) => {
            if (!view || !win || win.isDestroyed()) return;
            const was = placed.get(view)?.win || BrowserWindow.fromWebContents(view.webContents);
            if (was && was !== win) {
                unplace(view);
                try {
                    if (!was.isDestroyed()) was.contentView.removeChildView(view);
                } catch {}
            }
            if (front || !win.contentView.children.includes(view)) win.contentView.addChildView(view);
            placed.set(view, { win, bounds, onClose });
            follow(win);
            inWindow.get(win).add(view);
            size(view);
        };

        const boundsOf = (boundsKey) => {
            try {
                const saved = JSON.parse(store.read(boundsKey) || 'null');
                return saved && saved.width && saved.height ? saved : null;
            } catch (e) {
                console.warn('[deckit] could not read where window ' + boundsKey + ' was left', e);
                return null;
            }
        };

        // A remembered place on a display no longer attached would open the window off-screen; its size is still kept.
        const onScreen = (b) =>
            !!b &&
            screen.getAllDisplays().some((d) => {
                const a = d.workArea;
                return b.x + b.width > a.x && b.x < a.x + a.width && b.y + b.height > a.y && b.y < a.y + a.height;
            });

        const writeBounds = (entry) => {
            if (!entry || entry.win.isDestroyed()) return;
            try {
                store.write(entry.boundsKey, JSON.stringify(entry.win.getNormalBounds()));
            } catch (e) {
                console.warn('[deckit] could not remember where window ' + entry.boundsKey + ' was left', e);
            }
        };

        const raise = (win) => {
            if (!win || win.isDestroyed()) return;
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
        };

        const openWindow = ({
            key,
            title = CONFIG.name,
            view,
            background,
            glass = false,
            size,
            boundsKey,
            beforeClose,
            afterDetach,
            onResize,
            barStyle,
            onShown,
        } = {}) => {
            if (!key || !view) return null;
            const already = open.get(key);
            if (already && !already.win.isDestroyed()) {
                raise(already.win);
                return already.win;
            }

            const bk = boundsKey || `window:${key}`;
            const saved = boundsOf(bk);
            const placed = onScreen(saved);

            const win = new BrowserWindow({
                ...DEFAULT_SIZE,
                ...(size || {}),
                ...(placed ? saved : saved ? { width: saved.width, height: saved.height } : {}),
                title,
                /* No background colour with vibrancy: any colour, even a clear one, is laid over the blur.
         `hud` because macOS only lets us pick a material, and the others tint so much that the
         glass page over them reads as solid. `active` keeps the blur when the window loses focus. */
                ...(glass
                    ? { vibrancy: 'hud', visualEffectState: 'active' }
                    : { backgroundColor: background || FALLBACK_BG }),
                // No drag region comes with this: the page or the bar must provide one.
                titleBarStyle: 'hidden',
                trafficLightPosition: LIGHTS_AT,
            });

            // The embedding app may recolour every window it did not make on a theme change, and a colour on a glass window removes the blur for good.
            if (glass) win.setBackgroundColor = () => {};

            const entry = { win, view, boundsKey: bk, afterDetach, detached: false };
            open.set(key, entry);
            // Registered before the view is placed, so it runs while the view is still in the window.
            const release = () => {
                if (entry.detached) return;
                entry.detached = true;
                try {
                    beforeClose?.(win, view);
                } catch (e) {
                    console.error('[deckit] window beforeClose', e);
                }
                writeBounds(entry); // still alive here, so this is the last chance
                unplace(view);
                try {
                    onShown?.(0);
                } catch {}
                try {
                    afterDetach?.(view);
                } catch (e) {
                    console.error('[deckit] window afterDetach', e);
                }
            };
            guard(win, 'close', release);
            guard(win.webContents, 'destroyed', release);

            place(view, win);
            attachBar(win, view.webContents, { ...(barStyle || {}), onShown });

            // Saved as it moves, not on close: a quit can take the window without a close event.
            let saveTimer = null;
            const remember = () => {
                clearTimeout(saveTimer);
                saveTimer = setTimeout(() => writeBounds(entry), 400);
            };
            guard(win, 'resize', () => {
                remember();
                onResize?.(win);
            });
            guard(win, 'move', remember);
            guard(win, 'closed', () => {
                if (open.get(key) === entry) open.delete(key);
            });

            return win;
        };

        /* The pointer is read from the screen in main, not from the content: a page cannot see the
     pointer over cross-origin frames, and over the window buttons macOS reports no events. */
        const CHROME_H = BAR.HEIGHT;
        const LIGHTS = BAR.LIGHTS;
        const MOTION_MS = BAR.MOTION_MS;
        const EASE = BAR.EASE;
        const POLL_MS = 50;
        const LIGHTS_AT = { x: 13, y: Math.round((CHROME_H - 14) / 2) };

        /* The class is set at once and the slide is laid over it with the Web Animations API: state
     waiting on an animation frame never arrives in an occluded window, which produces no frames. */
        const stripPage = (background, color, font) =>
            'data:text/html,' +
            encodeURIComponent(
                `<!doctype html><meta charset="utf-8"><style>
       html,body{margin:0;height:100%;overflow:hidden;background:transparent;cursor:default;
         -webkit-user-select:none;user-select:none}
       #b{position:absolute;left:0;right:0;top:0;height:${CHROME_H}px;display:flex;
         align-items:center;justify-content:center;box-sizing:border-box;
         padding:0 ${LIGHTS}px;background:${background};color:${color};
         font:600 13px ${font};border-bottom:1px solid rgba(128,128,128,.22);
         box-shadow:0 6px 16px rgba(0,0,0,.28);
         transform:translateY(-100%);opacity:0}
       #b.on{transform:none;opacity:1}
       #g{display:flex;align-items:center;gap:7px;min-width:0;max-width:100%}
       #i{flex:0 0 auto;width:15px;height:15px;object-fit:contain;opacity:.75}
       #i:not([src]){display:none}
       #t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.9}
     </style><div id=b><div id=g><img id=i alt=""><div id=t></div></div></div>
     <script>
       window.sk=(on)=>{
         const b=document.getElementById("b");
         b.classList.toggle("on",on);
         if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
         const up={transform:"translateY(-100%)",opacity:0},down={transform:"none",opacity:1};
         b.animate(on?[up,down]:[down,up],{duration:${MOTION_MS},easing:"${EASE}"});
       };
       window.name_=(t,icon)=>{
         document.getElementById("t").textContent=t||"";
         const i=document.getElementById("i");
         if(icon)i.src=icon;else i.removeAttribute("src");
       };
     <\/script>`
            );

        const attachBar = (
            win,
            content,
            { background = FALLBACK_BG, color = '#d1d2d3', font = '-apple-system, system-ui, sans-serif', onShown } = {}
        ) => {
            const { WebContentsView } = require('electron');
            const strip = new WebContentsView();
            try {
                strip.setBackgroundColor('#00000000');
            } catch {}
            win.contentView.addChildView(strip); // last, so it is above whatever is in the window
            strip.webContents.loadURL(stripPage(background, color, font));

            let shown = false;
            let turn = 0;
            let poll = null;

            // While hidden, the strip is a thin band at the top edge so arriving there is noticed over any page.
            const lay = () => {
                try {
                    if (win.isDestroyed()) return;
                    const [w] = win.getContentSize();
                    strip.setBounds({ x: 0, y: 0, width: Math.round(w), height: shown ? CHROME_H : BAR.SHOW_AT });
                } catch (e) {
                    console.error('[deckit] window bar layout', e);
                }
            };

            const js = (code) => {
                if (strip.webContents.isDestroyed()) return;
                strip.webContents.executeJavaScript(code, true).catch(() => {});
            };

            const stopPoll = () => {
                clearInterval(poll);
                poll = null;
            };
            const startPoll = () => {
                stopPoll();
                poll = setInterval(() => {
                    try {
                        if (win.isDestroyed()) return stopPoll();
                        // During a drag the window lags the pointer, which would briefly read as below the bar and hide it mid-drag.
                        if (grab) return;
                        const c = screen.getCursorScreenPoint();
                        const b = win.getContentBounds();
                        const inside = c.x >= b.x && c.x < b.x + b.width && c.y >= b.y && c.y < b.y + b.height;
                        if (inside) gesture.moved(c.y - b.y);
                        else gesture.left();
                    } catch {}
                }, POLL_MS);
            };

            /* On hide the strip shrinks only after the slide ends, or the bar is cut off mid-animation.
       `turn` stops a quick hide-then-show from shrinking a bar that came back. */
            const show = (on) => {
                if (shown === on || win.isDestroyed()) return;
                shown = on;
                const mine = ++turn;
                try {
                    win.setWindowButtonVisibility(on);
                } catch {}
                try {
                    onShown?.(on ? CHROME_H : 0);
                } catch {}
                if (on) {
                    lay();
                    js('window.sk&&window.sk(true)');
                    startPoll();
                    return;
                }
                stopPoll();
                js('window.sk&&window.sk(false)');
                setTimeout(() => {
                    if (turn === mine && !shown) lay();
                }, MOTION_MS);
            };
            const gesture = BAR.watch({ show: () => show(true), hide: () => show(false) });

            // setPosition throws on non-integers, and input coordinates are fractional on a scaled display.
            const whole = (n) => (Number.isFinite(n) ? Math.round(n) : null);

            /* Dragged by hand rather than with `-webkit-app-region: drag`, which only real OS events can
       press, so a test cannot. The window moves under the pointer, so view-local deltas stay
       relative to the grab point. */
            let grab = null;
            guard(strip.webContents, 'input-event', (_e, input) => {
                try {
                    if (win.isDestroyed()) return;
                    if (!shown) {
                        if (input.type === 'mouseMove' || input.type === 'mouseEnter') {
                            gesture.moved(0);
                            return;
                        }
                        // A press on the top edge both summons the bar and starts the drag.
                        if (input.type !== 'mouseDown') return;
                        gesture.moved(0);
                    }
                    if (input.type === 'mouseDown') {
                        if (input.clickCount === 2) {
                            win.isMaximized() ? win.unmaximize() : win.maximize();
                            grab = null;
                            return;
                        }
                        grab = { x: input.x, y: input.y };
                    } else if (input.type === 'mouseMove' && grab) {
                        const [wx, wy] = win.getPosition();
                        const x = whole(wx + (input.x - grab.x));
                        const y = whole(wy + (input.y - grab.y));
                        if (x === null || y === null) return;
                        win.setPosition(x, y);
                    } else if (input.type === 'mouseUp') {
                        grab = null;
                    }
                } catch (e) {
                    grab = null;
                    console.error('[deckit] window bar input', e);
                }
            });

            guard(win, 'blur', () => gesture.left());
            guard(win, 'resize', lay);

            let name = { title: '', icon: '' };
            const say = () => {
                js(`window.name_&&window.name_(${JSON.stringify(name.title)},${JSON.stringify(name.icon)})`);
                try {
                    if (!win.isDestroyed()) win.setTitle(name.title || CONFIG.name);
                } catch {}
            };
            const titled = guard(content, 'page-title-updated', (_e, t) => {
                name.title = String(t || '');
                say();
            });
            const iconed = guard(content, 'page-favicon-updated', (_e, icons) => {
                name.icon = String((icons && icons[0]) || '');
                say();
            });

            /* The content can outlive the window (the panel is moved between windows), so its listeners are
       removed here. A view's webContents is not closed by its window, so the strip's is closed here. */
            guard(win, 'closed', () => {
                stopPoll();
                gesture.stop();
                if (!content.isDestroyed()) {
                    content.removeListener('page-title-updated', titled);
                    content.removeListener('page-favicon-updated', iconed);
                }
                try {
                    if (!strip.webContents.isDestroyed()) strip.webContents.close();
                } catch {}
            });
            guard(
                strip.webContents,
                'did-finish-load',
                async () => {
                    if (!name.title) {
                        try {
                            name.title = content.getTitle() || '';
                        } catch {}
                    }
                    // A favicon set before the bar was attached sent its event already, so it is read off the page.
                    if (!name.icon) {
                        try {
                            name.icon = String(
                                (await content.executeJavaScript(
                                    "(document.querySelector(\"link[rel~='icon']\")||{}).href||''",
                                    true
                                )) || ''
                            );
                        } catch {}
                    }
                    say();
                },
                { once: true }
            );

            lay();
            try {
                win.setWindowButtonVisibility(false);
            } catch {}
            return { strip, show };
        };

        const dress = (win, opts = {}) => {
            if (!win || win.isDestroyed()) return null;
            return attachBar(win, win.webContents, opts);
        };

        const get = (key) => {
            const e = open.get(key);
            return e && !e.win.isDestroyed() ? e.win : null;
        };

        const close = (key) => {
            const win = get(key);
            if (!win) return false;
            win.close();
            return true;
        };

        return {
            open: openWindow,
            get,
            close,
            raise,
            has: (k) => !!get(k),
            place,
            dress,
            LIGHTS_AT,
            FALLBACK_BG,
        };
    }
);
