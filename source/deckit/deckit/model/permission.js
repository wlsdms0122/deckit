import * as MAIN_PROCESS_PERMISSION from '../main-process/model/permission.js';
import * as DECK from '../../deck/main.js';
import * as WEB_PERMISSION from '../web/model/permission.js';
import * as CLIPBOARD_PERMISSION from '../clipboard/model/permission.js';
import * as NOTIFY_PERMISSION from '../notify/model/permission.js';
import * as KEYMAP_PERMISSION from '../keymap/model/permission.js';
import * as OPEN_PERMISSION from '../open/model/permission.js';

// MARK: - Property
// What deckit's capabilities are granted by, the widest first. Those that reach past the app (system.*) go
// before deck's own, which reach other mods.
const WIDER_THAN = DECK.MODS;
const PERMISSIONS = [
    {
        id: MAIN_PROCESS_PERMISSION.MAIN_PROCESS,
        name: 'Main Process',
        icon: 'server',
        means: "It starts code in the app's main process, outside its own pages, where code can read and write your files, reach the network and start programs.",
    },
    {
        id: WEB_PERMISSION.FILES,
        name: 'Files',
        icon: 'fileText',
        means: 'It can open files on this Mac in its own pages, where it can read what they hold.',
    },
    {
        id: WEB_PERMISSION.NETWORK,
        name: 'Network',
        icon: 'globe',
        means: 'It can read any address on the web or your network, past the rules that keep one site from reading another.',
    },
    {
        id: WEB_PERMISSION.CERTIFICATES,
        name: 'Certificates',
        icon: 'shieldCheck',
        means: "It can accept a certificate this Mac cannot verify, for one site, so that site's pages load.",
    },
    {
        id: WEB_PERMISSION.SITE_PERMISSIONS,
        name: 'Site Permissions',
        icon: 'mic',
        means: "It can let a site's pages use the camera, the microphone, notices, what you copied, your location and the apps links open in, and take that back.",
    },
    {
        id: CLIPBOARD_PERMISSION.CLIPBOARD,
        name: 'Clipboard',
        icon: 'copy',
        means: 'It can read what you copied, from any app. Copying text needs no permission.',
    },
    {
        id: NOTIFY_PERMISSION.NOTIFICATIONS,
        name: 'Notifications',
        icon: 'bell',
        means: 'It can show notices in the corner of the screen, while you are looking at something else.',
    },
    {
        id: KEYMAP_PERMISSION.GLOBAL_KEYS,
        name: 'Keys Everywhere',
        icon: 'monitor',
        means: 'Its keys work wherever you are in the app, whatever is in front, and are taken from every page there.',
    },
    {
        id: KEYMAP_PERMISSION.KEY_MAP,
        name: 'Key Map',
        icon: 'keyboard',
        means: 'It can bind, change and switch off the keys of every mod.',
    },
    {
        id: OPEN_PERMISSION.URL_SCHEMES,
        name: 'URL Schemes',
        icon: 'layers',
        means: 'It can choose which mod is asked first to open an address of each scheme, and switch them off.',
    },
];

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { PERMISSIONS, WIDER_THAN };
