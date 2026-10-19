// MARK: - Property
// The owner of the keys registered through what connect answers, the host app's and whatever it put on deckit; a
// mod's keys are owned by its id, and no mod id starts with @.
const APP_OWNER = '@app';

// MARK: - Initializer
// MARK: - Public
// A binding's id in the keymap: its owner's and its action's.
function idOf(owner, action) {
    return owner + '.' + action;
}

// MARK: - Private

export { APP_OWNER, idOf };
