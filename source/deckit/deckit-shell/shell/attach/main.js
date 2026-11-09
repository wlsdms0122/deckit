import { answered, refuseUnknown } from '../../deckit/connect/main.js';
import { checked } from '../../deckit/environment/index.js';
import * as STYLE_PERMISSION from '../style/model/permission.js';
import * as FONTS_PERMISSION from '../fonts/model/permission.js';
import * as WINDOW_PERMISSION from '../window/model/permission.js';
import * as KEY_PERMISSION from '../key/model/permission.js';
import * as ENVIRONMENT from '../environment/index.js';
import { createDrop } from '../drop/main.js';
import { createPage } from '../page/main.js';
import * as SHELL_LAYER from '../mod/model/layer.js';
import { createRegion } from '../region/main.js';
import { createDesktop } from '../desktop/main.js';
import { createDock } from '../dock/main.js';
import { createStyle } from '../style/main.js';
import { createTheme } from '../theme/main.js';
import { createFonts } from '../fonts/main.js';
import { createWindows } from '../window/main.js';
import { createOverlay } from '../overlay/main.js';
import { createKey } from '../key/main.js';
import { createFiles } from '../files/main.js';
import * as FIELD from '../mods/field.js';

// MARK: - Property
const SHELL_CONFIG = { dock: null };
// What the host app answers the UI: where it is shown.
const ATTACH_ANSWERS = ['start', 'show', 'desktopTitled', 'showWindow', 'closeWindow'];
// The permissions the UI defines, in the order a person reads them.
const SHELL_PERMISSIONS = [WINDOW_PERMISSION, STYLE_PERMISSION, FONTS_PERMISSION, KEY_PERMISSION];
// The UI is attached once, to what connect answered.
let attached = false;

// MARK: - Public
// How a host app puts deckit's UI on deckit, once, before it is ready: `deckit` is what connect answered,
// `environment` what the environment gives the UI (environment: SHELL), `host` answers where the UI is shown, `web`
// is what the web engine's attach answered, the UI laying the web pages mods show and taking the keys pressed in each
// as the web engine adopts it, and `config` is the UI's configuration: `dock`, the ids of the mods the Dock keeps at
// the first start, in order, or else the app mods the host app ships. The UI starts with deckit, before any mod
// launches.
function attach(deckit, environment, { host, web, config = {} } = {}) {
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
    for (const key of FIELD.KEYS) deckit.fields.define(key);
    for (const model of SHELL_PERMISSIONS)
        for (const permission of model.PERMISSIONS) deckit.permissions.define(permission);
    const KEY = createKey({ deckit, keys: ENV.keys });
    web.onPage((page) => KEY.listen(page));
    const PAGES = createPage({ deckit, web, pages: ENV.pages });
    const OVERLAY = createOverlay({ deckit, web, PAGES, KEY });
    // A stage, held to what a stage is as the environment makes it.
    const makeStage = () => checked(ENV.stage(), ENVIRONMENT.STAGE, 'a stage');
    const REGION = createRegion({ deckit });
    const DROP = createDrop({ deckit, PAGES });
    const DESKTOP = createDesktop({
        REGION,
        PAGES,
        OVERLAY,
        KEY,
        makeStage,
        actionOnDoubleClick: ENV.actionOnDoubleClick,
        deckit,
        web,
        host,
    });
    const WINDOWS = createWindows({
        deckit,
        web,
        PAGES,
        OVERLAY,
        DESKTOP,
        KEY,
        makeStage,
        showWindow: (control, options) => host.showWindow(control, options),
        closeWindow: (control) => host.closeWindow(control),
    });
    const DOCK = createDock({ deckit, DESKTOP, WINDOWS, host, dock });
    const STYLE = createStyle({ deckit });
    const THEME = createTheme({ deckit });
    const FONTS = createFonts({ deckit, installed: ENV.fonts });
    const FILES = createFiles({ deckit, dialogs: ENV.dialogs, reveal: ENV.reveal });
    deckit.onStart(() => {
        THEME.start({ draws: (sender) => !!deckit.mods.modOf(sender) || !!deckit.pages.nameOf(sender) });
        FONTS.start({ onChange: THEME.setFonts });
        STYLE.start();
        OVERLAY.start({ keyboardOf: WINDOWS.keyboardOf });
        REGION.start();
        DROP.start();
        DESKTOP.start({ WINDOWS, DOCK });
        WINDOWS.start();
        DOCK.start();
        FILES.start();
        host.start({ setTheme: THEME.set, desktop: DESKTOP.control, openWindow: WINDOWS.openWeb });
    });
}

export { attach };
