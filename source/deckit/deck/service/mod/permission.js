DeckitModule.define(
    'deck/service/mod/permission',
    {
        uses: [],
        provides: ['define', 'all'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod may ask for, in the order they were defined: deck's own, then each layer's that adds what they
        // grant. `name` and `means` are what a person reads before installing; `icon` names the glyph it is shown with.
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

        // MARK: - Initializer
        // MARK: - Public
        // A permission a layer grants what it adds with. Defined before the app is ready: a manifest asking for one
        // that is not is refused.
        function define({ id, name, icon = '', means }) {
            if (permissions.some((permission) => permission.id === id)) throw new Error(`[deckit] ${id} is defined`);
            permissions.push(Object.freeze({ id, name, icon, means }));
        }

        function all() {
            return permissions;
        }

        // MARK: - Private

        return { define, all };
    }
);
