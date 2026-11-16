// The users, as a host keeps them: the principals that may sit at a seat, asked of deckit's core as the keys are
// (keys.js). A user made while the app runs sits from its next attach on.
const KEYS = require('./keys.js');

// `id` is a user from now on, read as `name`; one kept already takes the name. Refused for an id a mod installed in
// deckit's folder is listed under: the core reads its mods first. With `key`, the base64 of an Ed25519 public key's 32
// bytes, that key may authenticate as the user.
function add({ home, id, name, key = null }) {
    const registered = key ? [['key/add', { principal: id, scheme: KEYS.SCHEME, key, name }]] : [];
    return KEYS.asks(home, [['catalog/read', {}], ['user/add', { id, name }], ...registered]);
}

// `id` is a user no more: its record, its keys and what deckit keeps of it are erased.
function remove({ home, id }) {
    return KEYS.ask(home, 'user/remove', { id });
}

// The users, each `{ id, name }`, by id.
function list({ home }) {
    return KEYS.ask(home, 'user/list', {});
}

module.exports = { add, remove, list };
