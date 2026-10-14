DeckitModule.define(
    'deckit/web/model/permission',
    {
        uses: [],
        provides: ['FILES', 'NETWORK', 'CERTIFICATES', 'SITE_PERMISSIONS'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // The ids of the permissions this service checks; what each grants is in the app's list.
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
