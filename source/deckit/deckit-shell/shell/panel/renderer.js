import * as SCROLL from '../ui/scroll/index.js';
import * as KIT from '../ui/kit/index.js';
import * as CHANNEL from '../../deck/channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// The mod's sidebar scrolls when it is taller than its slot.
const STYLE = `
    .deckit-view { position: fixed; inset: 0; overflow: hidden; font: 15px var(--deckit-font); }
    .deckit-view-content { position: absolute; display: flex; flex-direction: column; color: var(--deckit-text); }
    .deckit-view-slot { position: absolute; overflow: hidden; }
    .deckit-view-sidebar {
        position: absolute;
        top: 0;
        left: 0;
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 0 12px;
    }
    .deckit-view-sidebar > * { flex-shrink: 0; }
`;

// MARK: - Initializer
// MARK: - Public
// The panel in a mod's page, its channels bound with `channels`: `mount(view)`, `show()`, by which the mod asks to be
// on screen, and `pins`, what a mod with deckit.mods reads and changes of the panel's list, on deck.mods: `pinned()`,
// the children the person pinned to it, and `setPinned(id, pinned)`.
function createPanel({ channels }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const pins = Object.freeze({
        pinned: () => PROTOCOL.pinned.invoke(),
        setPinned: (id, pinned) => PROTOCOL.setPinned.invoke({ id: String(id), pinned: !!pinned }),
    });

    // MARK: - Public
    // One mod's view, in its own page, laid out where the panel's guide says: the content in its room and the sidebar,
    // if the view has one, in the slot the panel lends it. `tell` calls a part of the view (didAppear, didDisappear);
    // `layers` is what floats in the page.
    function mount({ theme, view, tell, layers }) {
        KIT.addStyle(STYLE);
        const setup = PROTOCOL.setup.invoke();
        const { motion: MOTION } = theme;
        let guide = setup.guide;
        let open = setup.shown;
        let appeared = false;

        const root = element('div', 'deckit-view');
        const content = element('div', 'deckit-view-content');
        Object.assign(view.content.style, { width: '100%', flex: '1 1 auto', minHeight: '0' });
        content.append(view.content);
        // Two boxes: the slot animates its width while the sidebar keeps its own, so what is inside does not reflow
        // against its minimum widths every frame.
        const slot = view.sidebar ? element('div', 'deckit-view-slot') : null;
        if (slot) {
            const sidebar = element('div', 'deckit-view-sidebar');
            sidebar.append(view.sidebar);
            SCROLL.edgeFade(sidebar);
            slot.append(sidebar);
            root.append(slot);
        }
        root.append(content);
        document.body.appendChild(root);
        lay();
        appear();

        layers.onChange((on) => PROTOCOL.floating.send({ on }));
        // Main took this Escape, so the field never saw it: it is played again as a keydown. A field that handles
        // it keeps the caret; one that does not is left, as a browser would, so the next Escape reaches the page.
        PROTOCOL.escape.handle(() => {
            const top = layers.top();
            if (top) {
                top.dismiss();
                return true;
            }
            const field = document.activeElement;
            if (!isField(field)) return false;
            const handled = !field.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })
            );
            if (!handled && document.activeElement === field) field.blur();
            return true;
        });
        PROTOCOL.guide.on((next) => {
            guide = next;
            lay();
        });
        PROTOCOL.visible.on(({ open: on, animate }) => {
            if (open === on) return;
            open = on;
            appear();
            if (!animate) {
                if (on) enterAtOnce();
                return;
            }
            if (on) fadeIn();
            else fadeOut();
        });
        PROTOCOL.play.on(({ direction }) => (direction === 'out' ? fadeOut() : fadeIn()));

        // didAppear and didDisappear alternate, worked out in this one place.
        function appear() {
            if (open === appeared) return;
            appeared = open;
            tell(open ? 'didAppear' : 'didDisappear');
        }

        // The content's title bar area is the mod's (`ui.titleBar`): as much of the window's bar as lies over the
        // content, from past what the panel covers at its start, the window's buttons. Floating, the panel's rounding
        // needs the page clear at the corners.
        function lay() {
            const { content: area, titleBar: bar, animation } = guide;
            const transition = animation
                ? ['left', 'top', 'width', 'height', 'opacity']
                      .map((property) => `${property} ${animation.duration}ms ${animation.easing}`)
                      .join(', ')
                : 'none';
            place(content, area, transition);
            if (slot) {
                slot.style.display = guide.sidebar ? '' : 'none';
                if (guide.sidebar) {
                    place(slot, guide.sidebar, transition);
                    slot.style.opacity = guide.sidebar.width ? '1' : '0';
                    if (guide.sidebar.width) slot.firstChild.style.width = guide.sidebar.width + 'px';
                    // What of the window's bar lies over the sidebar is left clear, its buttons above all.
                    slot.firstChild.style.paddingTop = (bar ? Math.max(0, bar.height - guide.sidebar.y) : 0) + 'px';
                }
            }
            document.documentElement.toggleAttribute('data-deckit-title-bar', !!bar);
            const page = document.documentElement.style;
            page.setProperty('--deckit-title-bar-area-height', (bar ? Math.max(0, bar.height - area.y) : 0) + 'px');
            page.setProperty('--deckit-title-bar-area-x', (bar ? coveredFrom(area, guide.obscured, bar) : 0) + 'px');
            root.style.borderRadius = guide.floating ? '12px' : '0';
        }

        // The start is read back before the end is written, or both land in
        // one style pass and nothing transitions.
        function fadeIn() {
            Object.assign(root.style, { transition: 'none', opacity: '0', transform: entrance() });
            void root.offsetHeight;
            Object.assign(root.style, { transition: motion(), opacity: '1', transform: 'none' });
        }

        // A view that faded out while it was on screen comes back where it stood.
        function enterAtOnce() {
            Object.assign(root.style, { transition: 'none', opacity: '1', transform: 'none' });
        }

        function fadeOut() {
            Object.assign(root.style, { transition: motion(), opacity: '0', transform: entrance() });
        }

        // A region's page fades in place: the parent around it does not grow or shrink with it.
        function entrance() {
            return guide.region ? 'none' : MOTION.entrance;
        }

        function motion() {
            return `opacity ${MOTION.fast}ms ${MOTION.easing}, transform ${MOTION.base}ms ${MOTION.easing}`;
        }
    }

    function show() {
        PROTOCOL.show.send();
    }

    return Object.freeze({ mount, show, pins });
}

// Why what `deck.view` was handed is not a view, or ''. Its parent is the region's to judge.
function viewProblem(value) {
    if (value?.content?.nodeType !== Node.ELEMENT_NODE)
        return 'takes { content, sidebar, parent, didAppear, didDisappear }, content an element';
    return '';
}

// A mod's local key runs only in its page in front, so one with no view has only its keys that work past it.
function keyProblem(key, view) {
    return key.scope === 'local' && !view
        ? 'a mod with no view is never in front, so only a key that works past its page does'
        : '';
}

// MARK: - Private
// How far into the room's top, `bar` tall, the covered rect reaches from its start.
function coveredFrom(room, covered, bar) {
    if (!covered?.width || !covered.height) return 0;
    if (covered.x > room.x || covered.y >= bar.height) return 0;
    return Math.max(0, covered.x + covered.width - room.x);
}

function place(box, { x, y, width, height }, transition) {
    Object.assign(box.style, { transition, left: x + 'px', top: y + 'px', width: width + 'px', height: height + 'px' });
}

function isField(element) {
    return !!element?.matches?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
}

function element(tag, className) {
    const made = document.createElement(tag);
    made.className = className;
    return made;
}

export { createPanel, viewProblem, keyProblem };
