// Deckit.app's configuration of deckit, handed to connect.
const path = require('path');

// The mods Deckit ships, in the load order they take until the person changes it: the panel lists those with a view
// in it too, until the person arranges its list.
const SHIPS = ['editor', 'finder', 'note', 'browser', 'calendar', 'forge', 'bot', 'settings', 'deckit', 'switcher'];
// By interface, the mods Deckit places in its list until the person orders it: each interface a shipped mod defines,
// implemented by that mod.
const IMPLEMENTATIONS = {
    'switcher/actions': ['switcher'],
    'settings/buttons': ['settings'],
    'calendar/accounts': ['calendar'],
    'forge/workflows': ['forge'],
};
// Run unpackaged, its data is in the folder DECKIT_DATA names (../main.js), and its id is that folder's own, so what
// WebKit keeps of its pages, which is kept for the app that runs it, is that folder's alone too.
const data = process.env.DECKIT_DATA;
const id = data
    ? 'deckit-' + require('crypto').createHash('sha1').update(path.resolve(data)).digest('hex').slice(0, 12)
    : 'deckit';

module.exports = {
    config: { id, name: 'Deckit', implementations: IMPLEMENTATIONS },
    folders: {
        home: data ? path.join(data, 'deckit') : null,
        ship: SHIPS.map((id) => path.join(__dirname, '..', 'deckit', 'mods', id)),
    },
};
