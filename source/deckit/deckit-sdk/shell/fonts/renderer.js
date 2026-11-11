import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// What `fonts.set` takes: the fonts whole, any of a face's name and a size, each left out for its default.
const SETS = Object.freeze([
    [
        'fonts',
        'object',
        [
            ['text', 'string?'],
            ['size', 'number?'],
        ],
    ],
]);

// MARK: - Initializer
// MARK: - Public
// `shell.fonts`, its channels bound with `channels`, `request` making its request as the shell's handle guards it:
// `set(fonts)`, guarded by deckit.fonts, takes the fonts whole, any of `{ text, size }`, each left out for its default,
// and resolves to the fonts as kept. Every page's theme wears them (`theme.fonts`, `theme.textFont`, `theme.textSize`).
function tool({ channels, request }) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    return Object.freeze({
        set: request('fonts.set', { guard: PROTOCOL.set.guard, signature: SETS }, (fonts) =>
            PROTOCOL.set.invoke(named(fonts))
        ),
    });
}

// The fonts installed, `{ families, monospaced }`, read at each call of what it answers, in a page whose channels are
// bound with `channels`.
function installed({ channels }) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    return () => PROTOCOL.installed.invoke();
}

// MARK: - Private
// The fonts `fonts` names: a key bound to no value, and one `fonts.set` does not take, are not named, and so are the
// default.
function named(fonts) {
    return Object.fromEntries(SETS[0][2].map(([key]) => [key, fonts[key]]).filter(([, value]) => value != null));
}

export { tool, installed };
