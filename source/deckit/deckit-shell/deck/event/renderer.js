import * as EVENT_BUS from './bus.js';
import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as SCOPED from '../mod/model/scoped-name.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The events of a mod's page: one bus for every lifecycle of its run. `RUN` is the page's run.
export function createEvent({ RUN }) {
    // MARK: - Property
    let bus = null;

    // MARK: - Initializer
    // MARK: - Public
    // What a handle holds of events. `emit(name, ...args)` sends one of the mod's own, which listeners hear named
    // after it (SCOPED.scopedName); `on(named, listener)` hears any mod's, until its off or until `scope` is cut.
    // Values are copied. `handle` is the name the mod reaches them by.
    function forScope({ handle, scope }) {
        return {
            emit(name, ...args) {
                try {
                    PROTOCOL.emit.send({ run: RUN.number, name: String(name), args });
                } catch (error) {
                    RUN.fail(`${handle}.emit("${name}") takes values that can be copied: ${error.message || error}`);
                }
            },
            on(name, listener) {
                const named = String(name);
                if (!SCOPED.isScoped(named))
                    throw new Error(`${handle}.on() takes "<mod id>:<event name>", not "${named}"`);
                if (typeof listener !== 'function') throw new Error(`${handle}.on() takes a listener function`);
                const off = busNow().on(named, listener);
                scope.add(off);
                return off;
            },
        };
    }

    // MARK: - Private
    function busNow() {
        if (!bus) {
            bus = EVENT_BUS.make({
                call: (listener, args, name) => RUN.deliver(`on("${name}")`, listener, ...args),
                onNamesChange: (names) => PROTOCOL.listen.send({ run: RUN.number, names }),
            });
            PROTOCOL.event.on(({ name, args }) => bus.emit(name, ...args));
        }
        return bus;
    }

    return { forScope };
}
