import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';

// `running` is the mod the page runs; `deliver(label, listener, ...args)` calls a listener of the mod's and records on
// its row what it throws; `channels` binds the regions' channels in the page.
export function createRegion({ running, deliver, channels }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const listeners = new Set();
    let known = null; // interface -> [{ id, name, icon }]: asked for once, then told
    let count = 0;

    // MARK: - Initializer
    // MARK: - Public
    // What a handle holds of regions, what it makes ending as `scope` is cut. `region(element, interface)` makes a
    // place in the mod's view where the shell shows the views of that interface's children, for an interface the
    // manifest provides. A child runs in its own page, laid over what of `element` is seen as it moves, so what the
    // parent draws there is covered and nothing of the parent's floats over it. `place(id)` puts a child in this
    // region, out of any other it was in, and `clear()` leaves the region empty. The region ends when its element, once
    // in the page, leaves it. `children` are the mod's children: the mods whose view names an interface it provides
    // as their parent, while it owns it. `list(interface)` answers those of one interface
    // in the mods' order, and `onChange(listener)` hears `listener(interface, children)` each time an interface's
    // children change, answering its off.
    function forScope(scope) {
        return {
            region(element, named) {
                return make(element, named, scope);
            },
            children: Object.freeze({
                list: (named) => {
                    const problem = interfaceProblem(named);
                    if (problem) throw new Error(`children.list() ${problem}`);
                    return (childrenNow()[named] || []).slice();
                },
                onChange(listener) {
                    if (typeof listener !== 'function') throw new Error('onChange() takes a listener function');
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
        if (element?.nodeType !== Node.ELEMENT_NODE) throw new Error('shell.region() takes an element');
        const problem = interfaceProblem(named);
        if (problem) throw new Error(`shell.region() ${problem}`);
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
            const written = JSON.stringify([x, y, width, height]);
            if (written !== sent) {
                sent = written;
                PROTOCOL.rect.send({ region, interface: named, x, y, width, height });
            }
            requestAnimationFrame(follow);
        };
        follow();
        return Object.freeze({
            place: (id) => (ended ? refused() : PROTOCOL.place.invoke({ region, interface: named, id: String(id) })),
            clear: () => (ended ? refused() : PROTOCOL.place.invoke({ region, interface: named, id: null })),
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
        return Promise.reject(new Error('the region has ended: its element left the page'));
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

    return { forScope };
}

// What of `element` is seen: its rect cut to each ancestor that clips what overflows it, and nothing while it is
// hidden. A child laid over it is made as small as that, not cropped.
function seenRect(element) {
    if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
        return { x: 0, y: 0, width: 0, height: 0 };
    let { left, top, right, bottom } = element.getBoundingClientRect();
    for (let node = element.parentElement; node; node = node.parentElement) {
        const { overflowX, overflowY } = getComputedStyle(node);
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
