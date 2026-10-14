// MARK: - Property
// The owner of the keys the shell registers; a mod's keys are owned by its id, and no mod id starts with @.
const SHELL_OWNER = '@shell';

// MARK: - Initializer
// MARK: - Public
// A binding's id in the keymap: its owner's and its action's.
function idOf(owner, action) {
    return owner + '.' + action;
}

// MARK: - Private

export { SHELL_OWNER, idOf };
