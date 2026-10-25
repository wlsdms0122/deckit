// MARK: - Property
// The permissions this concept checks, as a person reads them before installing.
const FILES = 'system.files';
const NETWORK = 'system.network';
const CERTIFICATES = 'system.certificates';
const SITE_PERMISSIONS = 'system.site-permissions';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: FILES,
        name: 'Files',
        means: 'It can open files on this Mac in its own pages, where it can read what they hold.',
    }),
    Object.freeze({
        id: NETWORK,
        name: 'Network',
        means: 'It can read any address on the web or your network, past the rules that keep one site from reading another.',
    }),
    Object.freeze({
        id: CERTIFICATES,
        name: 'Certificates',
        means: "It can accept a certificate this Mac cannot verify, for one site, so that site's pages load.",
    }),
    Object.freeze({
        id: SITE_PERMISSIONS,
        name: 'Site Permissions',
        means: "It can let a site's pages use the camera, the microphone, notifications, what you copied, your location and the apps links open in, and take that back.",
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { FILES, NETWORK, CERTIFICATES, SITE_PERMISSIONS, PERMISSIONS };
