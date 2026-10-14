DeckitModule.define(
    'deck/module/version',
    {
        uses: [],
        provides: ['parse', 'satisfies'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        const SEMANTIC = /^(\d+)\.(\d+)\.(\d+)$/;

        // MARK: - Initializer
        // MARK: - Public
        // "MAJOR.MINOR.PATCH" as three numbers, or null when it is not written so.
        function parse(written) {
            const match = SEMANTIC.exec(String(written ?? ''));
            return match ? match.slice(1).map(Number) : null;
        }

        // Same major, and at least the wanted minor and patch.
        function satisfies(have, want) {
            const [major, minor, patch] = parse(have) || [];
            const [wantedMajor, wantedMinor, wantedPatch] = parse(want) || [];
            if (major === undefined || wantedMajor === undefined || major !== wantedMajor) return false;
            return minor > wantedMinor || (minor === wantedMinor && patch >= wantedPatch);
        }

        // MARK: - Private

        return { parse, satisfies };
    }
);
