import * as EVENT_BUS from './bus.js';
import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as SCOPED from './model/scoped-name.js';
import * as REQUEST from '../request/index.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The events of a mod's page: one bus for every lifecycle of its run. `RUN` is the page's run.
export function createEvent({ RUN }) {
    // MARK: - Property
    let bus = null;

    // MARK: - Initializer
    // MARK: - Public
    // What a handle holds of events, as `events`. Neither is a request: each throws its refusal. `emit(name, ...args)`
    // sends one of the mod's own, which listeners hear named after it (SCOPED.scopedName), refused INVALID_ARGUMENT for
    // a name that is no string or args that cannot be copied; `on(named, listener)` hears one of a name its manifest
    // names, its own id or an interface it uses or provides, until its off or until `scope` is cut, refused
    // INVALID_ARGUMENT for a name that is no `<mod id>:<event name>` or a listener that is no function, then
    // NOT_PERMITTED for any other name. `handle` is the name the mod reaches them by.
    function forScope({ handle, scope }) {
        const events = `${handle}.events`;
        const invalid = (message) => REQUEST.refusal('call', 'INVALID_ARGUMENT', message);
        return {
            events: Object.freeze({
                emit(name, ...args) {
                    if (typeof name !== 'string') throw invalid(`${events}.emit() takes a name that is a string`);
                    try {
                        PROTOCOL.emit.send({ run: RUN.number, name, args });
                    } catch (error) {
                        throw invalid(
                            `${events}.emit("${name}") takes values that can be copied: ${error.message || error}`
                        );
                    }
                },
                on(named, listener) {
                    if (typeof named !== 'string' || !SCOPED.isScoped(named))
                        throw invalid(`${events}.on() takes "<mod id>:<event name>", not ${String(named)}`);
                    if (typeof listener !== 'function') throw invalid(`${events}.on() takes a listener function`);
                    if (!isNamed(SCOPED.modOf(named)))
                        throw REQUEST.refusal(
                            'call',
                            'NOT_PERMITTED',
                            `${events}.on() hears the names of its own id and its interfaces, not "${named}"`
                        );
                    return scope.add(busNow().on(named, listener));
                },
            }),
        };
    }

    // MARK: - Private
    // Whether the mod's manifest names `owner`, a mod id or an interface.
    function isNamed(owner) {
        const { id, uses, provides } = RUN.mod;
        return owner === id || Object.hasOwn(uses, owner) || Object.hasOwn(provides, owner);
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
