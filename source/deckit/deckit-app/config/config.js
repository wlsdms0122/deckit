// Deckit.app's configuration of deckit, handed to connect.
const path = require('path');

// The mods Deckit ships, in the order they take until the person changes it: the Dock keeps those with a view from
// the first start, until the person changes it. Each is a system mod.
const SHIPS = [
    'editor',
    'finder',
    'note',
    'browser',
    'calendar',
    'forge',
    'bot',
    'mods',
    'settings',
    'deckit',
    'switcher',
    'status-bar',
    'notifications',
    'commands',
    'keymap',
    'urls',
    'configuration',
    'packages',
];
// Run unpackaged, its data is in the folder DECKIT_DATA names (../main.js), and its id is that folder's own, so what
// WebKit keeps of its pages, which is kept for the app that runs it, is that folder's alone too.
const data = process.env.DECKIT_DATA;
const id = data
    ? 'deckit-' + require('crypto').createHash('sha1').update(path.resolve(data)).digest('hex').slice(0, 12)
    : 'deckit';

module.exports = {
    config: { id, name: 'Deckit' },
    folders: {
        home: data ? path.join(data, 'deckit') : null,
        ship: SHIPS.map((id) => ({ folder: path.join(__dirname, '..', 'deckit', 'mods', id), system: true })),
    },
};
