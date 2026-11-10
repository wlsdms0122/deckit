import * as CHANNEL from '../../deckit/channel/index.js';
import * as REQUEST from '../../deckit/request/index.js';
import * as DECLARED from './protocol.js';
import * as FIELD from '../mods/field.js';

// MARK: - Property
// A child's view fills its page.
const STYLE = `
    .deckit-view { position: fixed; inset: 0; display: flex; flex-direction: column; overflow: hidden; }
    .deckit-view > * { flex: 1 1 auto; min-height: 0; }
`;

// `running` is the mod the page runs; `deliver(label, listener, ...args)` calls a listener of the mod's and records on
// its row what it throws; `channels` binds the regions' channels in the page; `request` makes each of its requests as
// the shell's handle guards them; `windowOf(element)` is the id of the window of the page's an element is in, or null.
export function createRegion({ running, deliver, channels, request, windowOf }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const listeners = new Set();
    let known = null; // interface -> [{ id, name, icon }]: asked for once, then told
    let count = 0;

    // MARK: - Initializer
    // MARK: - Public
    // What a handle holds of regions, what it makes ending as `scope` is cut. `region(element, interface)` makes a
    // place in one of the mod's windows where the shell shows the views of that interface's children, for an interface
    // the manifest provides, and throws its refusal, INVALID_ARGUMENT, for anything else. A child runs in its own page,
    // laid over what of `element` is seen as it moves, so what the parent draws there is covered and nothing of the
    // parent's floats over it. `place(id)`, a request, puts a child in this region, out of any other it was in, and
    // `clear()`, a request, leaves the region empty; each is refused at call, ENDED, once the region has ended. The
    // region ends when its element, once in the page, leaves it. `children` are the mod's children: the mods whose view
    // names an interface it provides as their parent, while it owns it. `list(interface)`, a request, resolves to those
    // of one interface in the mods' order, and `onChange(listener)` hears `listener(interface, children)` each time an
    // interface's children change, answering its off, and throws its refusal for a listener that is no function.
    function forScope(scope) {
        return {
            region(element, named) {
                return make(element, named, scope);
            },
            children: Object.freeze({
                list: request(
                    'children.list',
                    { guard: PROTOCOL.children.guard, signature: [['interface', 'string']] },
                    (named) => {
                        const problem = interfaceProblem(named);
                        if (problem) throw invalid(`children.list: ${problem}`);
                        return (childrenNow()[named] || []).slice();
                    }
                ),
                onChange(listener) {
                    if (typeof listener !== 'function') throw invalid('children.onChange: listener is no function');
                    childrenNow();
                    listeners.add(listener);
                    return scope.add(() => listeners.delete(listener));
                },
            }),
        };
    }

    // MARK: - Private
    // A region ends once its element, after it was in the page, leaves it, or as `scope` is cut.
    function make(element, named, scope) {
        if (element?.nodeType !== Node.ELEMENT_NODE) throw invalid('region: element is no element');
        const problem = interfaceProblem(named);
        if (problem) throw invalid(`region: ${problem}`);
        const region = ++count;
        let sent = '';
        let entered = false; // a region made in attach() has its element in the page only once the view is up
        let ended = false;
        const end = scope.add(() => {
            ended = true;
            PROTOCOL.end.send({ region });
        });
        const follow = () => {
            if (ended) return;
            if (!element.isConnected && entered) return end();
            entered ||= element.isConnected;
            const { x, y, width, height } = seenRect(element);
            const window = windowOf(element);
            const written = JSON.stringify([window, x, y, width, height]);
            if (written !== sent) {
                sent = written;
                PROTOCOL.rect.send({ region, interface: named, window, x, y, width, height });
            }
            next();
        };
        // Followed in the frames of the document the element is in, or of the page's while that one is shown nowhere:
        // a window that closes hands the next to the page.
        const next = () => {
            const view = element.ownerDocument.defaultView;
            if (!view || view === window) return requestAnimationFrame(follow);
            const asked = view.requestAnimationFrame(() => {
                view.removeEventListener('pagehide', away);
                follow();
            });
            const away = () => {
                view.cancelAnimationFrame(asked);
                requestAnimationFrame(follow);
            };
            view.addEventListener('pagehide', away, { once: true });
        };
        follow();
        const show = (id) => (ended ? refused() : PROTOCOL.place.invoke({ region, interface: named, id }));
        return Object.freeze({
            place: request('place', { guard: PROTOCOL.place.guard, signature: [['id', 'string']] }, show),
            clear: request('clear', { guard: PROTOCOL.place.guard }, () => show(null)),
        });
    }

    // Why `named` is not an interface the mod gives regions for, or ''.
    function interfaceProblem(named) {
        if (typeof named !== 'string') return 'takes an interface the manifest provides';
        if (!Object.hasOwn(running.provides ?? {}, named))
            return `takes an interface the manifest provides, and ${named} is not one`;
        return '';
    }

    function refused() {
        return Promise.reject(REQUEST.refusal('call', 'ENDED', 'the region has ended'));
    }

    function invalid(message) {
        return REQUEST.refusal('call', 'INVALID_ARGUMENT', message);
    }

    // Each listener hears the interfaces whose children changed, one by one.
    function childrenNow() {
        if (known === null) {
            known = PROTOCOL.children.invoke();
            PROTOCOL.childrenChanged.on(({ children: next }) => {
                const was = known;
                known = next;
                for (const named of new Set([...Object.keys(was), ...Object.keys(next)])) {
                    if (JSON.stringify(was[named] || []) === JSON.stringify(next[named] || [])) continue;
                    for (const listener of [...listeners])
                        deliver('children.onChange()', listener, named, (next[named] || []).slice());
                }
            });
        }
        return known;
    }

    // A child's view, `shell.view.register`'s, in its own page, which the shell lays over the region that shows it:
    // `tell` calls a part of the view (didAppear, didDisappear). Answers `{ unmount, remove }`: on unmount a view on
    // screen disappears and what main tells of it is heard no more; on remove it is taken off the page.
    function mount({ view, tell }) {
        const style = document.createElement('style');
        style.textContent = STYLE;
        document.head.prepend(style);
        const root = document.createElement('div');
        root.className = 'deckit-view';
        root.append(view.content);
        document.body.appendChild(root);
        let appeared = false;
        let mounted = true;
        PROTOCOL.visible.on(({ open }) => {
            if (!mounted || appeared === open) return;
            appeared = open;
            tell(open ? 'didAppear' : 'didDisappear');
        });
        return {
            unmount() {
                if (appeared) tell('didDisappear');
                mounted = false;
            },
            remove() {
                root.remove();
                style.remove();
            },
        };
    }

    return { forScope, mount };
}

// Why what `shell.view.register` was handed is not a child's view this mod may have, or ''.
function viewProblem(value, running) {
    if (value?.content?.nodeType !== Node.ELEMENT_NODE)
        return 'takes { content, didAppear, didDisappear }, content an element';
    if (!FIELD.parentOf(running.fields, running)) return 'is for a mod whose manifest gives its view a parent';
    return '';
}

// What of `element` is seen: its rect cut to each ancestor that clips what overflows it, and nothing while it is
// hidden. A child laid over it is made as small as that, not cropped.
function seenRect(element) {
    if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
        return { x: 0, y: 0, width: 0, height: 0 };
    let { left, top, right, bottom } = element.getBoundingClientRect();
    for (let node = element.parentElement; node; node = node.parentElement) {
        const { overflowX, overflowY } = node.ownerDocument.defaultView.getComputedStyle(node);
        if (overflowX === 'visible' && overflowY === 'visible') continue;
        const box = node.getBoundingClientRect();
        const inner = { left: box.left + node.clientLeft, top: box.top + node.clientTop };
        left = Math.max(left, inner.left);
        top = Math.max(top, inner.top);
        right = Math.min(right, inner.left + node.clientWidth);
        bottom = Math.min(bottom, inner.top + node.clientHeight);
    }
    return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export { viewProblem };
