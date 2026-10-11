DeckitModule.define(
    'deckit/service/storage',
    {
        uses: ['deckit/service/home', 'deckit/service/storage/model/space', 'deckit/module/store'],
        provides: ['root', 'folderOf', 'host'],
        runs: 'node',
    },
    (home, SPACE, STORE) => {
        const path = require('path');

        // Not the app's userData: an app that updates can be reinstalled under us.
        const root = path.join(home.folder, 'data');
        const { read, write } = STORE;

        const folderOf = (space) => {
            const why = SPACE.nameProblem(space);
            if (why) throw new Error(why);
            return path.join(root, String(space));
        };

        // The core's keys ("window:bot:main") are encoded rather than refused; encoding leaves no separator.
        const hostFile = (key) => {
            const name = String(key || '');
            if (!name) throw new Error('a host key is needed');
            return path.join(root, SPACE.RESERVED, encodeURIComponent(name).replace(/^\./, '%2E') + '.json');
        };

        return Object.freeze({
            root,
            folderOf,
            host: Object.freeze({
                read: (key) => read(hostFile(key)),
                write: (key, json) => write(hostFile(key), json),
            }),
        });
    }
);
