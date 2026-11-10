import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DECLARED from '../../../deckit-sdk/shell/fonts/protocol.js';
import * as FONTS from './model/fonts.js';

// `deckit` is what connect answered; `installed()` answers the fonts installed (environment: SHELL.fonts).
export function createFonts({ deckit, installed }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const KEPT = 'fonts';
    let fonts = FONTS.DEFAULT;
    let keeping = Promise.resolve(); // the change being kept, which the next one waits for

    // MARK: - Initializer
    // MARK: - Public
    // The person's fonts, kept in the shell's state, which a mod with deckit.fonts changes: a change that is not one is
    // refused at call, INVALID_ARGUMENT. `onChange(fonts)` hears them at once and at each change.
    function start({ onChange }) {
        fonts = FONTS.keptOf(deckit.state.read(KEPT, {}));
        onChange(fonts);
        PROTOCOL.installed.handle(() => installed());
        PROTOCOL.set.handle((change) => {
            const problem = FONTS.problemOf(change);
            if (problem)
                throw Object.assign(new Error(`fonts.set: ${problem}`), { stage: 'call', kind: 'INVALID_ARGUMENT' });
            const kept = keeping.then(() => keep(change, onChange));
            keeping = kept.catch(() => {});
            return kept;
        });
    }

    // MARK: - Private
    // Worn only once kept: a change the core refuses leaves the fonts as they were.
    async function keep(change, onChange) {
        const next = FONTS.merged(fonts, change);
        if (JSON.stringify(next) === JSON.stringify(fonts)) return fonts;
        await deckit.state.write(KEPT, next);
        fonts = next;
        onChange(fonts);
        return fonts;
    }

    return { start };
}
