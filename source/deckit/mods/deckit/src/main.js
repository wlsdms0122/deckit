const { openAddress } = require('./open-address.js');

// What a person asks of deck itself, offered in the switcher as any mod's commands are: an address to open, a
// mod or the app to restart, deckit's folders, and what is running. It has no view.
module.exports = {
    keywords: ['deckit', 'deck'],
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg>`,

    start(deck) {
        const { ui } = deck;
        const APP_NAME = deck.about().name;
        const icon = (name) => ui.icon(name, { size: 16 });
        const address = openAddress({ ui, open: (url) => deck.open(url) });

        deck.commands(() => [
            {
                label: 'Open Address…',
                icon: icon('link'),
                keywords: ['url', 'scheme', 'open', '주소', '열기'],
                submenu: {
                    placeholder: 'An address with its scheme: https://…, file:///…',
                    search: (query) => address.entriesFor(query),
                },
            },
            {
                label: 'Restart Mod…',
                icon: icon('reload'),
                keywords: ['relaunch', 'reload', '재시작'],
                submenu: { placeholder: 'Search mods', entries: modEntries },
            },
            {
                label: 'Restart ' + APP_NAME,
                icon: icon('power'),
                keywords: ['relaunch', '재시작'],
                run: () => deck.mods.restart(),
            },
            {
                label: 'Show Mods Folder',
                icon: icon('folders'),
                keywords: ['finder', 'reveal'],
                run: () => deck.reveal(deck.about().mods),
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
                submenu: { placeholder: 'Versions', entries: versions },
            },
        ]);

        // One not running is launched. One that does not restart is a readout saying why: one that did not load, one
        // stopping, one waiting for a mod it requires. A refusal all the same is told in a notice.
        function modEntries() {
            const STATES = { launching: 'Starting', running: 'Running', notRunning: 'Not running' };
            const { found, running } = deck.mods.list();
            const icons = new Map(running.map((mod) => [mod.id, mod.icon]));
            const names = new Map(found.map((mod) => [mod.id, mod.name]));
            return found.map((mod) => {
                const entry = { label: mod.name, icon: icons.get(mod.id) || icon('puzzle') };
                const missing = mod.waitsFor.map((id) => names.get(id) ?? id);
                if (!mod.state) return { ...entry, hint: mod.problem || 'Did not load' };
                if (mod.state === 'terminating') return { ...entry, hint: 'Stopping' };
                if (missing.length)
                    return {
                        ...entry,
                        hint: `Needs ${missing.join(', ')}, which ${missing.length === 1 ? 'is' : 'are'} not running`,
                    };
                return { ...entry, hint: STATES[mod.state], run: () => deck.mods.relaunch(mod.id) };
            });
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
