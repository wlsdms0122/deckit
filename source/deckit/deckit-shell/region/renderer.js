import * as CHANNEL from '../deck/channel/index.js';
import * as DECLARED from './protocol.js';
import * as MOD from '../deck/catalog/model/mod.js';

// `deliver(label, listener, ...args)` calls a listener of the mod's and records on its row what it throws; `channels`
// binds the regions' channels in the page.
export function createRegion({ deliver, channels }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const listeners = new Set();
    let known = null; // [{ id, name, icon }]: asked for once, then told
    let count = 0;
    // The mod's children: the mods whose view names it as their parent. `list()` answers them in the person's
    // order, and `onChange(listener)` hears them each time they change, answering its off.
    const children = Object.freeze({
        list: () => childrenNow().slice(),
        onChange(listener) {
            if (typeof listener !== 'function') throw new Error('onChange() takes a listener function');
            childrenNow();
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    });

    // MARK: - Initializer
    // MARK: - Public
    // A place in the mod's view where the shell shows a child's. The child runs in its own page, laid over what of
    // `element` is seen as it moves, so what the parent draws there is covered and nothing of the parent's floats
    // over it. `place(id)` puts a child in this region, out of any other it was in, and `clear()` leaves the region
    // empty. The region ends when its element, once in the page, leaves it.
    function make(element) {
        if (element?.nodeType !== Node.ELEMENT_NODE) throw new Error('deck.region() takes an element');
        const region = ++count;
        let sent = '';
        let entered = false; // a region made in start() has its element in the page only once the view is up
        let ended = false;
        const follow = () => {
            if (!element.isConnected && entered) {
                ended = true;
                return PROTOCOL.end.send({ region });
            }
            entered ||= element.isConnected;
            const { x, y, width, height } = seenRect(element);
            const written = JSON.stringify([x, y, width, height]);
            if (written !== sent) {
                sent = written;
                PROTOCOL.rect.send({ region, x, y, width, height });
            }
            requestAnimationFrame(follow);
        };
        follow();
        return Object.freeze({
            place: (id) => (ended ? refused() : PROTOCOL.place.invoke({ region, id: String(id) })),
            clear: () => (ended ? refused() : PROTOCOL.place.invoke({ region, id: null })),
        });
    }

    // MARK: - Private
    function refused() {
        return Promise.reject(new Error('the region has ended: its element left the page'));
    }

    function childrenNow() {
        if (known === null) {
            known = PROTOCOL.children.invoke();
            PROTOCOL.childrenChanged.on(({ children: next }) => {
                known = next;
                for (const listener of [...listeners]) deliver('children.onChange()', listener, known.slice());
            });
        }
        return known;
    }

    return { children, make };
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

// Why a view's parent is not one a mod may name, or '': a mod it uses, in its [requires] or [optional].
export function parentProblem(parent, mod) {
    if (parent === undefined || parent === null) return '';
    if (typeof parent !== 'string') return "takes a parent that is a mod's id";
    if (!MOD.links(mod, parent)) return `names the parent ${parent}, which is in neither [requires] nor [optional]`;
    return '';
}
