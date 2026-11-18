// MARK: - Property
// The page the desktop is drawn in, at deckit://desktop/.
const PAGE_NAME = 'desktop';
// The documents it opens beside itself, by name: the backdrop under every window, the seats' cursors over everything
// on the stage, and each window's frame, under its content, buttons, over it, and dialog, over its content and children
// and under its buttons.
const BACKDROP = 'backdrop';
const CURSORS = 'cursors';

// MARK: - Initializer
// MARK: - Public
function frameOf(id) {
    return `frame-${id}`;
}

function buttonsOf(id) {
    return `buttons-${id}`;
}

function dialogOf(id) {
    return `dialog-${id}`;
}

// MARK: - Private

export { PAGE_NAME, BACKDROP, CURSORS, frameOf, buttonsOf, dialogOf };
