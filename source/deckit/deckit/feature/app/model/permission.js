DeckitModule.define(
    'deckit/feature/app/model/permission',
    {
        uses: ['deckit/service/main-process/model/permission'],
        provides: ['PERMISSIONS', 'WIDER_THAN'],
        runs: 'any',
    },
    (MAIN_PROCESS) => {
        // MARK: - Property
        // What deckit's capabilities are granted by, the widest first. Those that reach past the app (system.*) go
        // before deck's own, which reach other mods.
        const WIDER_THAN = 'deckit.mods';
        const PERMISSIONS = [
            {
                id: MAIN_PROCESS.PERMISSION,
                name: 'Main Process',
                icon: 'server',
                means: "It starts code in the app's main process, outside its own pages, where code can read and write your files, reach the network and start programs.",
            },
            {
                id: 'system.files',
                name: 'Files',
                icon: 'fileText',
                means: 'It can open files on this Mac in its own pages, where it can read what they hold.',
            },
            {
                id: 'system.network',
                name: 'Network',
                icon: 'globe',
                means: 'It can read any address on the web or your network, past the rules that keep one site from reading another.',
            },
            {
                id: 'system.certificates',
                name: 'Certificates',
                icon: 'shieldCheck',
                means: "It can accept a certificate this Mac cannot verify, for one site, so that site's pages load.",
            },
            {
                id: 'system.site-permissions',
                name: 'Site Permissions',
                icon: 'mic',
                means: "It can let a site's pages use the camera, the microphone, notices and the rest a page asks for, and take that back.",
            },
            {
                id: 'system.clipboard',
                name: 'Clipboard',
                icon: 'copy',
                means: 'It can read what you copied, from any app. Copying text needs no permission.',
            },
            {
                id: 'system.notifications',
                name: 'Notifications',
                icon: 'bell',
                means: 'It can show notices in the corner of the screen, while you are looking at something else.',
            },
            {
                id: 'system.global-keys',
                name: 'Keys Everywhere',
                icon: 'monitor',
                means: 'Its keys work wherever you are in the app, whatever is in front, and are taken from every page there.',
            },
            {
                id: 'deckit.key-map',
                name: 'Key Map',
                icon: 'keyboard',
                means: 'It can bind, change and switch off the keys of every mod.',
            },
            {
                id: 'deckit.url-schemes',
                name: 'URL Schemes',
                icon: 'layers',
                means: 'It can choose which mod is asked first to open an address of each scheme, and switch them off.',
            },
        ];

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { PERMISSIONS, WIDER_THAN };
    }
);
