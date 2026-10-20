import * as EVENT_BUS from './bus.js';
import * as CHANNEL from '../../../deckit-shell/channel/index.js';
import * as IPC from '../ipc/index.js';
import * as DECLARED from './protocol.js';
import * as SCOPED from '../mod/model/scoped-name.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// MARK: - Initializer
// MARK: - Public
// What a mod's deck holds of events. `emit(name, ...args)` sends one of its own, which listeners hear named
// after it (SCOPED.scopedName); `on(named, listener)` hears any mod's and answers its off. Values are copied.
// `owner` is how a call into the mod is made (`deliver`) and how a problem of its is recorded; `run`, the number of the
// page's run, which sends and listens.
function forMod({ owner, run }) {
    const bus = EVENT_BUS.make({
        call: (listener, args, name) => owner.deliver(`on("${name}")`, listener, ...args),
        onNamesChange: (names) => PROTOCOL.listen.send({ run, names }),
    });
    PROTOCOL.event.on(({ name, args }) => bus.emit(name, ...args));
    return {
        emit(name, ...args) {
            try {
                PROTOCOL.emit.send({ run, name: String(name), args });
            } catch (error) {
                owner.recordFailure(`deck.emit("${name}") takes values that can be copied: ${error.message || error}`);
            }
        },
        on(name, listener) {
            const named = String(name);
            if (!SCOPED.isScoped(named)) throw new Error(`deck.on() takes "<mod id>:<event name>", not "${named}"`);
            if (typeof listener !== 'function') throw new Error('deck.on() takes a listener function');
            return bus.on(named, listener);
        },
    };
}

// MARK: - Private

export { forMod };
