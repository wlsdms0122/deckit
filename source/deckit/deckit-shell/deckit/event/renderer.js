import * as EVENT_BUS from './bus.js';
import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as SCOPED from './model/scoped-name.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The events of a mod's page: one bus for every lifecycle of its run. `RUN` is the page's run.
export function createEvent({ RUN }) {
    // MARK: - Property
    let bus = null;

    // MARK: - Initializer
    // MARK: - Public
    // What a handle holds of events, as `events`. `emit(name, ...args)` sends one of the mod's own, which listeners
    // hear named after it (SCOPED.scopedName); `on(named, listener)` hears one of a name its manifest names, its own
    // id, an id in [dependencies] or an interface it uses or provides, until its off or until `scope` is cut, and is
    // refused any other. Values are copied. `handle` is the name the mod reaches them by.
    function forScope({ handle, scope }) {
        const events = `${handle}.events`;
        return {
            events: Object.freeze({
                emit(name, ...args) {
                    try {
                        PROTOCOL.emit.send({ run: RUN.number, name: String(name), args });
                    } catch (error) {
                        RUN.fail(
                            `${events}.emit("${name}") takes values that can be copied: ${error.message || error}`
                        );
                    }
                },
                on(name, listener) {
                    const named = String(name);
                    if (!SCOPED.isScoped(named))
                        throw new Error(`${events}.on() takes "<mod id>:<event name>", not "${named}"`);
                    if (!isNamed(SCOPED.modOf(named)))
                        throw new Error(
                            `${events}.on() hears the names of its own id, its [dependencies] and its interfaces, ` +
                                `not "${named}"`
                        );
                    if (typeof listener !== 'function') throw new Error(`${events}.on() takes a listener function`);
                    return scope.add(busNow().on(named, listener));
                },
            }),
        };
    }

    // MARK: - Private
    // Whether the mod's manifest names `owner`, a mod id or an interface.
    function isNamed(owner) {
        const { id, dependencies, uses, provides } = RUN.mod;
        return (
            owner === id ||
            Object.hasOwn(dependencies, owner) ||
            Object.hasOwn(uses, owner) ||
            Object.hasOwn(provides, owner)
        );
    }

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
