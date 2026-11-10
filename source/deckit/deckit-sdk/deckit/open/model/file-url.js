// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The file address of an absolute path, each part escaped, so a space or a # stays part of the name; '' for a path
// that is not absolute, and for one that holds a lone surrogate, which has no bytes in UTF-8 to escape.
function fileURL(path) {
    if (!path.startsWith('/')) return '';
    try {
        return 'file://' + path.split('/').map(encodeURIComponent).join('/');
    } catch {
        return '';
    }
}

// MARK: - Private

export { fileURL };
