DeckitModule.define(
    'deckit/service/keymap/model/binding-id',
    {
        uses: [],
        provides: ['DECKIT_OWNER', 'idOf'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // The owner of deckit's own keys; a plugin's keys are owned by its id, and no plugin id starts with @.
        const DECKIT_OWNER = '@deckit';

        // MARK: - Initializer
        // MARK: - Public
        // A binding's id in the keymap: its owner's and its action's.
        function idOf(owner, action) {
            return owner + '.' + action;
        }

        // MARK: - Private

        return { DECKIT_OWNER, idOf };
    }
);
