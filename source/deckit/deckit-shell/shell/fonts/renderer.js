import * as CHANNEL from '../../deck/channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// `shell.fonts` for a mod with deckit.fonts, its channels bound with `channels`: `get()` answers the person's fonts,
// `{ text, mono, size }`, each null for the default, at once, and `set(change)` takes any of them, null putting one
// back to its default, and resolves to the fonts as kept. Every page's theme wears them.
function tool({ channels }) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    return Object.freeze({
        get: () => PROTOCOL.current.invoke(),
        set: (change) => PROTOCOL.set.invoke(defined(change)),
    });
}

// MARK: - Private
// A member left undefined is not named: the fonts keep it.
function defined(change) {
    if (!change || typeof change !== 'object' || Array.isArray(change)) return change;
    return Object.fromEntries(Object.entries(change).filter(([, value]) => value !== undefined));
}

export { tool };
