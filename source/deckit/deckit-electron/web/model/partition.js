import * as SESSION from '../../../deckit-shell/web/model/session.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A mod's web sessions are under the app's id, so two apps in one profile stay apart, then the mod's id and the
// session's name. Neither id nor name holds a colon, so "mail" + "work-x" and "mail-work" + "x" differ.
export function createPartition({ CONFIG }) {
    function prefixOf(modId) {
        return `persist:${CONFIG.id}:${modId}:`;
    }

    function spell(modId, name) {
        return spellIn(prefixOf(modId), name);
    }

    // { mod, name } for a partition spelled as a mod's session, or null.
    function read(partition) {
        const prefix = `persist:${CONFIG.id}:`;
        if (!String(partition).startsWith(prefix)) return null;
        const [mod, name, ...rest] = String(partition).slice(prefix.length).split(':');
        if (rest.length || !mod || !SESSION.NAME.test(name || '')) return null;
        return { mod, name };
    }

    return { prefixOf, spell, read };
}

// A session's partition under a mod's prefix, as prefixOf answers it: how a mod's page spells one with what main
// told it.
function spellIn(prefix, name) {
    return prefix + SESSION.nameOf(name);
}

// MARK: - Private

export { spellIn };
