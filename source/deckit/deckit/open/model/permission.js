// MARK: - Property
// The permissions this service checks, as a person reads them before installing. `reach`: `system`, past the
// app, or `app`, inside it.
// What a mod holds to choose which mod is asked first to open each scheme's addresses.
const URL_SCHEMES = 'deckit.url-schemes';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: URL_SCHEMES,
        name: 'URL Schemes',
        icon: 'layers',
        means: 'It can choose which mod is asked first to open an address of each scheme, and switch them off.',
        reach: 'app',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { URL_SCHEMES, PERMISSIONS };
