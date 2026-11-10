import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// What `fonts.set` takes: any of the fonts, each a face's name or a size, null putting one back to its default.
const SETS = Object.freeze([
    [
        'change',
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
// `set(change)`, guarded by deckit.fonts, takes any of `{ text, size }`, null putting one back to its default, and
// resolves to the fonts as kept. Every page's theme wears them (`theme.textFont`, `theme.textSize`).
function tool({ channels, request }) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    return Object.freeze({
        set: request('fonts.set', { guard: PROTOCOL.set.guard, signature: SETS }, (change) =>
            PROTOCOL.set.invoke(named(change))
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
// The fonts `change` names: a key it leaves undefined, and one `fonts.set` does not take, are not named, and the fonts
// keep them.
function named(change) {
    return Object.fromEntries(SETS[0][2].map(([key]) => [key, change[key]]).filter(([, value]) => value !== undefined));
}

export { tool, installed };
