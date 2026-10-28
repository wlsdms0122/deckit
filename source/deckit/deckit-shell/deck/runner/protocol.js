// Between a mod's page and the runner. Main knows which mod a message is from by the page it came from, and which run
// of that page by the `run` that `load` answered, carried back by what tells main how the run went.
import * as CHANNEL from '../channel/index.js';

// What the page runs: the mod's manifest, its entry's source, and which run this is.
export const load = CHANNEL.pageToMain('deckit-shell:mod-load', {}, { reply: true, sync: true });
// What it read of the class its entry exports, as part of `summary`, and how many lifecycles its run stacks.
export const described = CHANNEL.pageToMain('deckit-shell:mod-described', {
    run: 'number',
    summary: 'object',
    lifecycles: 'number',
});
// Started, its first lifecycle joined, with what it contributes. `contributions`: `{ exports, awaits }`, the lifecycle
// that opened its exports, if one has, and the lowest lifecycle that waits for each mod's, beside what is on deck added;
// `summary`, what it contributes as a person reads it.
export const started = CHANNEL.pageToMain('deckit-shell:mod-started', {
    run: 'number',
    contributions: 'object',
    summary: 'object',
});
// Another of its lifecycles joined: what it contributes now, all of it, as `started` tells it.
export const joined = CHANNEL.pageToMain('deckit-shell:mod-joined', {
    run: 'number',
    contributions: 'object',
    summary: 'object',
});
// A problem recorded against the mod, which a person reads on its row.
export const problem = CHANNEL.pageToMain('deckit-shell:mod-problem', { run: 'number', problem: 'string' });
// It did not start, and why: what the mods that require it are told.
export const notStarted = CHANNEL.pageToMain('deckit-shell:mod-not-started', { run: 'number', problem: 'string' });
// Its run is ending: answered once each of its lifecycles has ended.
export const stop = CHANNEL.mainToPage('deckit-shell:mod-stop', { reply: true });
