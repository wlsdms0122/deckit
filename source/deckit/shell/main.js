import * as STYLE_PERMISSION from './style/model/permission.js';
import { createReply } from './reply/index.js';
import { createRegion } from './region/main.js';
import { createPanel } from './panel/main.js';
import { createSwitcher } from './switcher/main.js';
import { createStyle } from './style/main.js';
import { createTheme } from './theme/main.js';

// MARK: - Property
// What the host app answers the shell: where it is shown is the app's.
const ANSWERS = ['start', 'showsPanel', 'show', 'dismiss', 'summonSwitcher', 'panelTitled'];
// The shell's channels are the process's: it is attached once.
let attached = false;

// MARK: - Public
// How a host app puts deckit's shell on deckit, once, before it is ready: `deckit` is what connect answered, and
// `host` answers where the shell is shown. The shell starts with deckit, before any mod launches.
function attach(deckit, { host } = {}) {
    if (attached) throw new Error('[deckit] attach is called once');
    const missing = ANSWERS.filter((name) => typeof host?.[name] !== 'function');
    if (missing.length) throw new Error(`[deckit] the host does not answer ${missing.join(', ')}`);
    attached = true;
    deckit.permissions.define({
        id: STYLE_PERMISSION.STYLES,
        name: 'Styles',
        icon: 'eye',
        means: "It can change how every page in the app looks, other mods' among them, and so read what they show.",
    });
    const REPLY = createReply();
    const REGION = createRegion();
    const PANEL = createPanel({ REPLY, REGION });
    const SWITCHER = createSwitcher({ REPLY, PANEL });
    const STYLE = createStyle();
    const THEME = createTheme();
    deckit.onStart(() => {
        THEME.start({ draws: (sender) => !!deckit.mods.modOf(sender) || !!deckit.pages.nameOf(sender) });
        STYLE.start({ deckit });
        REGION.start({ deckit });
        PANEL.start({ deckit, host });
        SWITCHER.start({ deckit, host });
        deckit.keymap.delegate({ isActive: PANEL.isActive, monitor: PANEL.monitor });
        host.start({ setTheme: THEME.set, panel: PANEL.control, switcher: SWITCHER.control });
    });
}

export { attach };
