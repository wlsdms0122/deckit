import * as CHANNEL from '../../deck/channel/index.js';
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
    // it has entered more than it has left. A drop ends the drag wherever it lands. Once off, the destination tells
    // nothing more, a drop it took before included.
    function make(element, { onDrop, onTargeted }, scope) {
        let entered = 0;
        let live = true;
        const target = (on) => onTargeted && deliver('dropDestination() onTargeted()', onTargeted, on);
        const end = () => {
            if (!entered) return;
            entered = 0;
            target(false);
        };
        const listeners = {
            dragenter: (event) => {
                if (!carriesFiles(event)) return;
                event.preventDefault();
                if (entered++ === 0) target(true);
            },
            dragover: (event) => {
                if (!carriesFiles(event)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
            },
            dragleave: (event) => {
                if (!carriesFiles(event) || !entered) return;
                if (--entered === 0) target(false);
            },
            drop: (event) => {
                if (!carriesFiles(event) || !event.isTrusted) return;
                event.preventDefault();
                event.stopPropagation();
                const box = element.getBoundingClientRect();
                const at = { x: event.clientX - box.left, y: event.clientY - box.top };
                end();
                deliver('dropDestination() onDrop()', async () => {
                    const paths = await PROTOCOL.files.invoke();
                    if (live && paths.length) await onDrop(paths, at);
                });
            },
        };
        for (const [type, listener] of Object.entries(listeners)) element.addEventListener(type, listener);
        window.addEventListener('drop', end, true);
        return scope.add(() => {
            live = false;
            for (const [type, listener] of Object.entries(listeners)) element.removeEventListener(type, listener);
            window.removeEventListener('drop', end, true);
            end();
        });
    }

    return { forScope };
}

function carriesFiles(event) {
    return !!event.dataTransfer?.types.includes('Files');
}
