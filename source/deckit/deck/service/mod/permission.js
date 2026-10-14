DeckitModule.define(
    'deck/service/mod/permission',
    {
        uses: [],
        provides: ['define', 'all'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod may ask for, the widest first: deck's own, and each layer's that adds what they grant, where it
        // placed them. `name` and `means` are what a person reads before installing; `icon` names the glyph it is
        // shown with.
        const permissions = [
            {
                id: 'deckit.mods',
                name: 'Mods',
                icon: 'puzzle',
                means: 'It can see every installed mod, add one from a folder and delete installed ones, with what they stored.',
            },
            {
                id: 'deckit.mod-settings',
                name: 'Mod Settings',
                icon: 'sliders',
                means: 'It can read and change the settings of every mod, not only its own.',
            },
        ];
        let read = false; // a manifest has been read against them

        // MARK: - Initializer
        // MARK: - Public
        // A permission a layer grants what it adds with, before `before`'s place or last. Defined before any manifest
        // is read: one read against the permissions there were is not read again.
        function define({ id, name, icon = '', means }, { before = null } = {}) {
            if (read) throw new Error(`[deckit] ${id} is defined after manifests were read`);
            if (permissions.some((permission) => permission.id === id)) throw new Error(`[deckit] ${id} is defined`);
            const at = permissions.findIndex((permission) => permission.id === before);
            permissions.splice(at < 0 ? permissions.length : at, 0, Object.freeze({ id, name, icon, means }));
        }

        function all() {
            read = true;
            return permissions;
        }

        // MARK: - Private

        return { define, all };
    }
);
