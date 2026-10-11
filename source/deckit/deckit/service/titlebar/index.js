DeckitModule.define(
    'deckit/service/titlebar',
    {
        uses: ['deckit/config', 'deckit/service/log/main'],
        provides: ['HEIGHT', 'BUTTONS_AT', 'attach'],
        runs: 'main',
    },
    (CONFIG, LOG) => {
        // MARK: - Property
        const HEIGHT = 38;
        // Room the macOS window buttons take in the corner, and where they sit.
        const BUTTONS_WIDTH = 82;
        const BUTTONS_AT = { x: 13, y: Math.round((HEIGHT - 14) / 2) };
        // The pointer this close to the top edge brings the bar down, and below this it goes back up.
        const SHOW_AT = 6;
        const HIDE_PAST = HEIGHT + 6;
        const HIDE_DELAY = 90;
        // A large surface moving a short distance snaps at the kit's usual speed, so the bar moves slower.
        const MOTION_MS = 260;
        const EASE = 'cubic-bezier(.2,.7,.3,1)';
        const POLL_MS = 50;
        const FALLBACK = { background: '#1a1d21', color: '#d1d2d3', font: '-apple-system, system-ui, sans-serif' };

        // MARK: - Initializer
        // MARK: - Public
        // The bar of a deckit window: hidden, it comes down when the pointer reaches the top edge, and carries the
        // window's buttons, its title and icon, and the drag that moves it. `follow` is a webContents whose title
        // and icon it shows; without one, `name` says them. `onShown` hears how far down it reaches.
        function attach(window, { style = {}, follow = null, onShown = null } = {}) {
            const { WebContentsView, screen } = require('electron');
            const look = { ...FALLBACK, ...style };
            const strip = new WebContentsView();
            strip.setBackgroundColor('#00000000');
            // Last, so it is above whatever is in the window.
            window.contentView.addChildView(strip);
            strip.webContents.loadURL(pageOf(look));

            let shown = false;
            let turn = 0;
            let poll = null;
            let grab = null;
            const title = { text: '', icon: '' };
            const gesture = watch({ show: () => show(true), hide: () => show(false) });

            LOG.guard(strip.webContents, 'input-event', (_event, input) => drag(input));
            LOG.guard(window, 'blur', () => gesture.left());
            LOG.guard(window, 'resize', lay);
            LOG.guard(window, 'closed', () => {
                stopPoll();
                gesture.stop();
                strip.webContents.close();
            });
            if (follow) followNames(follow);
            LOG.guard(strip.webContents, 'did-finish-load', say, { once: true });
            lay();
            window.setWindowButtonVisibility(false);

            function name(text, icon = '') {
                title.text = String(text || '');
                title.icon = String(icon || '');
                say();
            }

            // While hidden, the strip is a thin band at the top edge, so arriving there is noticed over any page.
            function lay() {
                if (window.isDestroyed()) return;
                const [width] = window.getContentSize();
                strip.setBounds({ x: 0, y: 0, width: Math.round(width), height: shown ? HEIGHT : SHOW_AT });
            }

            function run(code) {
                if (!strip.webContents.isDestroyed()) strip.webContents.executeJavaScript(code, true).catch(() => {});
            }

            function say() {
                run(`window.setTitle(${JSON.stringify(title.text)}, ${JSON.stringify(title.icon)})`);
                if (!window.isDestroyed()) window.setTitle(title.text || CONFIG.name);
            }

            // On hide the strip shrinks only after the slide ends, or the bar is cut off mid-slide. `turn` keeps a
            // quick hide then show from shrinking a bar that came back.
            function show(on) {
                if (shown === on || window.isDestroyed()) return;
                shown = on;
                const mine = ++turn;
                window.setWindowButtonVisibility(on);
                onShown?.(on ? HEIGHT : 0);
                if (on) {
                    lay();
                    run('window.slide(true)');
                    startPoll();
                    return;
                }
                stopPoll();
                run('window.slide(false)');
                setTimeout(() => turn === mine && !shown && lay(), MOTION_MS);
            }

            // The pointer is read from the screen: a page cannot see it over cross-origin frames, and over the window
            // buttons macOS reports nothing.
            function startPoll() {
                stopPoll();
                poll = setInterval(() => {
                    if (window.isDestroyed()) return stopPoll();
                    // During a drag the window lags the pointer, which would read as below the bar and hide it.
                    if (grab) return;
                    const cursor = screen.getCursorScreenPoint();
                    const bounds = window.getContentBounds();
                    const inside =
                        cursor.x >= bounds.x &&
                        cursor.x < bounds.x + bounds.width &&
                        cursor.y >= bounds.y &&
                        cursor.y < bounds.y + bounds.height;
                    if (inside) gesture.moved(cursor.y - bounds.y);
                    else gesture.left();
                }, POLL_MS);
            }

            function stopPoll() {
                clearInterval(poll);
                poll = null;
            }

            // The window moves under the pointer, so deltas stay relative to the grab point. setPosition takes
            // integers only, and coordinates are fractional on a scaled display.
            function drag(input) {
                if (!shown) {
                    if (input.type === 'mouseMove' || input.type === 'mouseEnter') return gesture.moved(0);
                    // A press on the top edge both brings the bar down and starts the drag.
                    if (input.type !== 'mouseDown') return;
                    gesture.moved(0);
                }
                if (input.type === 'mouseDown' && input.clickCount === 2) {
                    if (window.isMaximized()) window.unmaximize();
                    else window.maximize();
                    grab = null;
                } else if (input.type === 'mouseDown') {
                    grab = { x: input.x, y: input.y };
                } else if (input.type === 'mouseMove' && grab) {
                    const [x, y] = window.getPosition();
                    window.setPosition(Math.round(x + input.x - grab.x), Math.round(y + input.y - grab.y));
                } else if (input.type === 'mouseUp') {
                    grab = null;
                }
            }

            // The webContents can outlive the window, so what it is told is taken back when the window goes.
            function followNames(contents) {
                const titled = LOG.guard(contents, 'page-title-updated', (_event, text) => name(text, title.icon));
                const iconed = LOG.guard(contents, 'page-favicon-updated', (_event, icons) =>
                    name(title.text, icons[0])
                );
                name(contents.getTitle());
                LOG.guard(window, 'closed', () => {
                    if (contents.isDestroyed()) return;
                    contents.removeListener('page-title-updated', titled);
                    contents.removeListener('page-favicon-updated', iconed);
                });
            }

            return { name };
        }

        // MARK: - Private
        // Fed pointer positions, not events: over the window buttons macOS takes the pointer and reports nothing.
        // A countdown running is not restarted: the poll comes every 50ms and would never let it run out.
        function watch({ show, hide }) {
            let timer = null;
            const cancel = () => {
                clearTimeout(timer);
                timer = null;
            };
            const soon = () => {
                if (timer) return;
                timer = setTimeout(() => {
                    timer = null;
                    hide();
                }, HIDE_DELAY);
            };
            return {
                moved(y) {
                    if (y <= SHOW_AT) {
                        cancel();
                        show();
                    } else if (y > HIDE_PAST) soon();
                    else cancel();
                },
                left: soon,
                stop: cancel,
            };
        }

        // The state is set at once and the slide laid over it with the Web Animations API: state waiting on an
        // animation frame never arrives in a covered window, which draws no frames.
        function pageOf({ background, color, font }) {
            return (
                'data:text/html,' +
                encodeURIComponent(`<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;height:100%;overflow:hidden;background:transparent;cursor:default;-webkit-user-select:none;user-select:none}
#bar{position:absolute;left:0;right:0;top:0;height:${HEIGHT}px;display:flex;align-items:center;justify-content:center;
  box-sizing:border-box;padding:0 ${BUTTONS_WIDTH}px;background:${background};color:${color};font:600 13px ${font};
  border-bottom:1px solid rgba(128,128,128,.22);box-shadow:0 6px 16px rgba(0,0,0,.28);transform:translateY(-100%);opacity:0}
#bar.shown{transform:none;opacity:1}
#name{display:flex;align-items:center;gap:7px;min-width:0;max-width:100%}
#icon{flex:0 0 auto;width:15px;height:15px;object-fit:contain;opacity:.75}
#icon:not([src]){display:none}
#title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.9}
</style><div id="bar"><div id="name"><img id="icon" alt=""><div id="title"></div></div></div>
<script>
window.slide = (shown) => {
  const bar = document.getElementById("bar");
  bar.classList.toggle("shown", shown);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const up = { transform: "translateY(-100%)", opacity: 0 }, down = { transform: "none", opacity: 1 };
  bar.animate(shown ? [up, down] : [down, up], { duration: ${MOTION_MS}, easing: "${EASE}" });
};
window.setTitle = (text, icon) => {
  document.getElementById("title").textContent = text;
  const image = document.getElementById("icon");
  if (icon) image.src = icon; else image.removeAttribute("src");
};
<\/script>`)
            );
        }

        return { HEIGHT, BUTTONS_AT, attach };
    }
);
