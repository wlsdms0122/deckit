DeckitModule.define(
    'deckit/service/event/page',
    {
        uses: ['deckit/module/event-bus', 'deckit/service/event/protocol', 'deckit/service/event/model/name'],
        provides: ['forMod'],
    },
    (EVENT_BUS, PROTOCOL, NAME) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // What a mod's deck holds of events. `emit(name, ...args)` sends one of its own, which listeners hear named
        // after it (NAME.nameOf); `on(named, listener)` hears any mod's and answers its off. Values are copied.
        // `owner` is how a call into the mod is made (`deliver`) and how a problem of its is recorded.
        function forMod({ owner }) {
            const bus = EVENT_BUS.make({
                call: (listener, args, name) => owner.deliver(`on("${name}")`, listener, ...args),
                onNamesChange: (names) => PROTOCOL.listen.send({ names }),
            });
            PROTOCOL.event.on(({ name, args }) => bus.emit(name, ...args));
            return {
                emit(name, ...args) {
                    try {
                        PROTOCOL.emit.send({ name: String(name), args });
                    } catch (error) {
                        owner.recordFailure(
                            `deck.emit("${name}") takes values that can be copied: ${error.message || error}`
                        );
                    }
                },
                on(name, listener) {
                    const named = String(name);
                    if (!NAME.isNamed(named))
                        throw new Error(`deck.on() takes "<mod id>:<event name>", not "${named}"`);
                    if (typeof listener !== 'function') throw new Error('deck.on() takes a listener function');
                    return bus.on(named, listener);
                },
            };
        }

        // MARK: - Private

        return { forMod };
    }
);
