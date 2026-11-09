// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The file address of an absolute path, each part escaped, so a space or a # stays part of the name; '' for a path
// that is not absolute.
function fileURL(path) {
    return path.startsWith('/') ? 'file://' + path.split('/').map(encodeURIComponent).join('/') : '';
}

// MARK: - Private

export { fileURL };
