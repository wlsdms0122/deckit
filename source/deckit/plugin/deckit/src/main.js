const { openAddress } = require('./open-address.js');

// What a person asks of deck itself, offered in the switcher as any plugin's commands are: an address to open, a
// plugin or the app to restart, deckit's folders, and what is running. It has no view.
module.exports = {
    keywords: ['deckit', 'deck'],
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg>`,

    start(deck) {
        const { ui } = deck;
        const APP_NAME = deck.about().name;
        const icon = (name) => ui.icon(name, { size: 16 });
        const address = openAddress({
            ui,
            urlSchemes: deck.urlSchemes,
            open: (url) => deck.open(url, { userInitiated: true }),
        });

        // Below the ranked list: a plugin that knows the address offers its own way to open it above.
        deck.resolve((query) => address.entriesFor(query).map((entry) => ({ ...entry, fallback: true })));
        deck.commands(() => [
            {
                label: 'Open Address…',
                icon: icon('link'),
                keywords: ['url', 'scheme', 'open', '주소', '열기'],
                page: {
                    placeholder: 'An address with its scheme: https://…, mailto:…',
                    search: (query) => address.entriesFor(query),
                },
            },
            {
                label: 'Restart Plugin…',
                icon: icon('reload'),
                keywords: ['relaunch', 'reload', '재시작'],
                page: { placeholder: 'Search running plugins', entries: runningPlugins },
            },
            {
                label: 'Restart ' + APP_NAME,
                icon: icon('power'),
                keywords: ['relaunch', '재시작'],
                run: () => deck.plugins.restart(),
            },
            {
                label: 'Show Plugins Folder',
                icon: icon('folders'),
                keywords: ['finder', 'reveal'],
                run: () => deck.reveal(deck.about().plugins),
            },
            {
                label: 'Show Data Folder',
                icon: icon('folder'),
                keywords: ['finder', 'reveal'],
                run: () => deck.reveal(deck.about().data),
            },
            {
                label: 'Show Log',
                icon: icon('fileText'),
                keywords: ['finder', 'reveal', '로그'],
                run: () => deck.reveal(deck.about().log),
            },
            {
                label: 'About ' + APP_NAME,
                icon: icon('info'),
                keywords: ['version', '버전'],
                page: { placeholder: 'Versions', entries: versions },
            },
        ]);

        function runningPlugins() {
            return deck.plugins.list().running.map((plugin) => ({
                label: plugin.name,
                hint: plugin.id,
                icon: plugin.icon || icon('puzzle'),
                run: () => deck.plugins.relaunch(plugin.id),
            }));
        }

        // Each copies itself, for a report.
        function versions() {
            const about = deck.about();
            return [
                about.app,
                `deckit ${about.version} (${about.source})`,
                'Electron ' + about.electron,
                'Chrome ' + about.chrome,
            ].map((text) => ({
                label: text,
                hint: 'Copy',
                icon: icon('copy'),
                run: () => deck.clipboard.writeText(text),
            }));
        }
    },
};
