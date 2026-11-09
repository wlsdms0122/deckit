import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';

// `deliver(label, listener, ...args)` calls a listener of the mod's and records on its row what it throws; `channels`
// binds the drop's channels in the page.
export function createDrop({ deliver, channels }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);

    // MARK: - Initializer
    // MARK: - Public
    // What a handle holds of drops, what it makes ending as `scope` is cut. `dropDestination(element, { onDrop,
    // onTargeted })` takes the files the person drags from outside the app onto `element`: `onTargeted(on)` hears a
    // drag of files come over it and leave, and `onDrop(paths, { x, y })` the files dropped, by their paths, at a point
    // from its top left. Of destinations one inside another, the innermost takes the drop. Answers its off.
    function forScope(scope) {
        return {
            dropDestination(element, { onDrop, onTargeted = null } = {}) {
                if (element?.nodeType !== Node.ELEMENT_NODE)
                    throw new Error('shell.dropDestination() takes an element');
                if (typeof onDrop !== 'function') throw new Error('shell.dropDestination() takes onDrop, a function');
                if (onTargeted !== null && typeof onTargeted !== 'function')
                    throw new Error("shell.dropDestination()'s onTargeted is a function");
                return make(element, { onDrop, onTargeted }, scope);
            },
        };
    }

    // MARK: - Private
    // A drag over a child of the element enters the child before it leaves the element, so the element is over while
    // it has entered more than it has left. A drop ends the drag wherever it lands in the document the element is in
    // then, the page's or a surface it opened. Once off, the destination tells nothing more, a drop it took before
    // included.
    function make(element, { onDrop, onTargeted }, scope) {
        let entered = 0;
        let live = true;
        let over = null; // the window of the document the drag is over the element in
        const target = (on) => onTargeted && deliver('dropDestination() onTargeted()', onTargeted, on);
        const end = () => {
            if (!entered) return;
            entered = 0;
            over.removeEventListener('drop', end, true);
            target(false);
        };
        const listeners = {
            dragenter: (event) => {
                if (!carriesFiles(event)) return;
                event.preventDefault();
                if (entered++ > 0) return;
                over = element.ownerDocument.defaultView;
                over.addEventListener('drop', end, true);
                target(true);
            },
            dragover: (event) => {
                if (!carriesFiles(event)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
            },
            dragleave: (event) => {
                if (!carriesFiles(event) || !entered) return;
                if (entered === 1) end();
                else entered--;
            },
            drop: (event) => {
                if (!carriesFiles(event) || !event.isTrusted) return;
                event.preventDefault();
                event.stopPropagation();
                const box = element.getBoundingClientRect();
                const at = { x: event.clientX - box.left, y: event.clientY - box.top };
                const view = element.ownerDocument.defaultView;
                const surface = view === window ? null : view.name;
                end();
                deliver('dropDestination() onDrop()', async () => {
                    const paths = await PROTOCOL.files.invoke({ surface });
                    if (live && paths.length) await onDrop(paths, at);
                });
            },
        };
        for (const [type, listener] of Object.entries(listeners)) element.addEventListener(type, listener);
        return scope.add(() => {
            live = false;
            for (const [type, listener] of Object.entries(listeners)) element.removeEventListener(type, listener);
            end();
        });
    }

    return { forScope };
}

function carriesFiles(event) {
    return !!event.dataTransfer?.types.includes('Files');
}
