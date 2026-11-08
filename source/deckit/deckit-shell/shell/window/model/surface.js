// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The name a page opens the content of its window `id` by (window.open('', name)).
function nameOf(id) {
    return `deckit-window-${id}`;
}

// MARK: - Private

export { nameOf };
