import { API } from './contract/index.js';
import { createEnvironment } from './environment/main.js';

// MARK: - Property
// What a host app reads of deck before it runs it: the version of the mod contract (contract/index.js) is API.
// Main's channels and the module's pages are the process's: the environment is made once.
let made = false;

// MARK: - Public
// The environment Electron gives deckit, made once, before the app is ready, and handed to deckit-shell's connect and
// attach: `preload` is the file the host app put together around deckit's page bundles, `core` the core's executable as
// the archive holds it, and `host` answers `openWindow({ title, size, place, focus })`, a window of the app's for a
// page deckit shows on its own, which it opens with `windows`, frames, puts the page in with
// `place(window, { bounds })` and shows, calling `focus()` as the window takes the keyboard. Answers what deck is given
// (deckit-shell/environment: MAIN), what the shell is (SHELL) and, for the host app alone, `windows`:
// `open(options) -> window` and `focused()`, the windows pages are laid in (window/index.js).
function environment({ preload, core, host } = {}) {
    if (made) throw new Error('[deckit] the environment is made once');
    if (typeof host?.openWindow !== 'function') throw new Error('[deckit] the host does not answer openWindow');
    if (!preload) throw new Error('[deckit] the environment needs the preload deckit pages load with');
    if (!core) throw new Error("[deckit] the environment needs the core: the archive's deckit executable");
    made = true;
    return createEnvironment({ core, preload, openWindow: (options) => host.openWindow(options) });
}

// MARK: - Private

export { API, environment };
