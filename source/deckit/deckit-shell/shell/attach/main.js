import { answered, refuseUnknown } from '../../deckit/connect/main.js';
import { checked } from '../../deckit/environment/index.js';
import * as STYLE_PERMISSION from '../style/model/permission.js';
import * as FONTS_PERMISSION from '../fonts/model/permission.js';
import * as WINDOW_PERMISSION from '../window/model/permission.js';
import * as ENVIRONMENT from '../environment/index.js';
import { createDrop } from '../drop/main.js';
import { createPage } from '../page/main.js';
import * as SHELL_LAYER from '../mod/model/layer.js';
import { createRegion } from '../region/main.js';
import { createPanel } from '../panel/main.js';
import { createStyle } from '../style/main.js';
import { createTheme } from '../theme/main.js';
import { createFonts } from '../fonts/main.js';
import { createWindow } from '../window/main.js';
import { createOverlay } from '../overlay/main.js';

// MARK: - Property
const SHELL_CONFIG = { dock: null };
// What the host app answers the UI: where it is shown.
const ATTACH_ANSWERS = [
    'start',
    'showsPanel',
    'show',
    'dismiss',
    'panelTitled',
    'showWindow',
    'hideWindow',
    'closeWindow',
];
// The permissions the UI defines, in the order a person reads them.
const SHELL_PERMISSIONS = [WINDOW_PERMISSION, STYLE_PERMISSION, FONTS_PERMISSION];
// The UI is attached once, to what connect answered.
let attached = false;

// MARK: - Public
// How a host app puts deckit's UI on deckit, once, before it is ready: `deckit` is what connect answered,
// `environment` what the environment gives the UI (environment: SHELL), `host` answers where the UI is shown, and
// `config` is the UI's configuration: `dock`, the ids of the mods the Dock keeps at the first start, in order, or else
// the mods the host app ships whose view names no parent. The UI starts with deckit, before any mod launches.
function attach(deckit, environment, { host, config = {} } = {}) {
    if (attached) throw new Error('[deckit] attach is called once');
    if (!answered()) throw new Error('[deckit] attach comes after connect');
    if (deckit !== answered()) throw new Error('[deckit] attach takes what connect answered');
    const ENV = checked(environment, ENVIRONMENT.SHELL, 'the environment');
    const missing = ATTACH_ANSWERS.filter((name) => typeof host?.[name] !== 'function');
    if (missing.length) throw new Error(`[deckit] the host does not answer ${missing.join(', ')}`);
    refuseUnknown('config', config, Object.keys(SHELL_CONFIG));
    const { dock } = { ...SHELL_CONFIG, ...config };
    attached = true;
    deckit.stack(SHELL_LAYER.LAYER);
    for (const model of SHELL_PERMISSIONS)
        for (const permission of model.PERMISSIONS) deckit.permissions.define(permission);
    const PAGES = createPage({ deckit, pages: ENV.pages });
    const OVERLAY = createOverlay({ deckit, PAGES });
    // A stage, held to what a stage is as the environment makes it.
    const makeStage = () => checked(ENV.stage(), ENVIRONMENT.STAGE, 'a stage');
    const REGION = createRegion({ deckit });
    const DROP = createDrop({ deckit, PAGES });
    const WINDOW = createWindow({
        deckit,
        PAGES,
        OVERLAY,
        makeStage,
        showWindow: (control, options) => host.showWindow(control, options),
        hideWindow: (control) => host.hideWindow(control),
        closeWindow: (control) => host.closeWindow(control),
    });
    const PANEL = createPanel({ REGION, PAGES, OVERLAY, makeStage, deckit, host, dock });
    const STYLE = createStyle({ deckit });
    const THEME = createTheme({ deckit });
    const FONTS = createFonts({ deckit, installed: ENV.fonts });
    deckit.onStart(() => {
        THEME.start({ draws: (sender) => !!deckit.mods.modOf(sender) || !!deckit.pages.nameOf(sender) });
        FONTS.start({ onChange: THEME.setFonts });
        STYLE.start();
        OVERLAY.start();
        REGION.start();
        DROP.start();
        PANEL.start();
        WINDOW.start();
        host.start({ setTheme: THEME.set, panel: PANEL.control });
    });
}

export { attach };
