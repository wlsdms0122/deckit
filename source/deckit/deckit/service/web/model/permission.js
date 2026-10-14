DeckitModule.define(
    'deckit/service/web/model/permission',
    {
        uses: [],
        provides: ['FILES', 'NETWORK', 'CERTIFICATES', 'SITE_PERMISSIONS'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod holds to open files in its own pages, to read any address, to accept a certificate this Mac cannot
        // verify, and to let a site's pages use what a page asks for.
        const FILES = 'system.files';
        const NETWORK = 'system.network';
        const CERTIFICATES = 'system.certificates';
        const SITE_PERMISSIONS = 'system.site-permissions';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { FILES, NETWORK, CERTIFICATES, SITE_PERMISSIONS };
    }
);
