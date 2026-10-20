// What Electron gives deck on a page's side (deckit-shell/environment: PAGE): its IPC carries the messages, and what
// runs a mod's code runs in the preload's isolated world, which the page's policy on scripts leaves alone.
import * as ORIGIN from '../deck/sandbox/model/origin.js';
import { messages } from '../messages/renderer.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
const environment = Object.freeze({ messages, modules: Object.freeze({ evaluate }) });

// MARK: - Private
// Named by its file at the mod's address, as a stack reads it.
function evaluate(source, { mod, file }) {
    const module = { exports: {} };
    new Function('module', 'exports', `${source}\n//# sourceURL=${ORIGIN.SCHEME.scheme}://${mod}/${file}`)(
        module,
        module.exports
    );
    return module.exports;
}

export { environment };
