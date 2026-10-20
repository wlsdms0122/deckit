import * as CONTRACT from './contract/index.js';
import { createEnvironment } from './environment/main.js';

// MARK: - Property
// The scheme deck's pages load from, for the host app's registerSchemesAsPrivileged: Electron takes privileged schemes
// in one call, before the app is ready, so the host app makes it with this beside its own.
const SCHEME = CONTRACT.SCHEME;
// Main's channels and its sessions' protocols are the process's: the environment is made once.
let made = false;

// MARK: - Public
// The environment Electron gives deckit, made once, before the app is ready, and handed to deckit-shell's connect:
// `preload` is the file the host app put together around deckit's page bundles, `core` the core's executable as the
// archive holds it, and `host` answers `openWindow`, as the windows are the app's. Answers what deck is given
// (deckit-shell/environment: MAIN) and, for the host app alone, `viewOf(page)`, `window.place` and `guard`.
function environment({ preload, core, host } = {}) {
    if (made) throw new Error('[deckit] the environment is made once');
    if (typeof host?.openWindow !== 'function') throw new Error('[deckit] the host does not answer openWindow');
    if (!preload) throw new Error('[deckit] the environment needs the preload deckit pages load with');
    if (!core) throw new Error("[deckit] the environment needs the core: the archive's deckit executable");
    made = true;
    return createEnvironment({ core, preload, openWindow: (options) => host.openWindow(options) });
}

// MARK: - Private

export { SCHEME, environment };
