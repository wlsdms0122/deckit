DeckitModule.define(
    'deckit/service/plugin/package/manifest',
    {
        uses: [
            'deckit/module/toml',
            'deckit/module/version',
            'deckit/service/open/model/scheme',
            'deckit/service/plugin/package/model/permission',
        ],
        provides: ['FILE', 'API', 'read', 'idProblem'],
        runs: 'any',
    },
    (TOML, VERSION, SCHEME, PERMISSION) => {
        // MARK: - Property
        const FILE = 'manifest.toml';
        // The version of the plugin contract, which a manifest's `api` is written against.
        const API = '2.0.0';
        const FIELDS = new Set(['id', 'name', 'version', 'api', 'url-schemes', 'requires', 'permissions']);

        // MARK: - Initializer
        // MARK: - Public
        // Returns { manifest, problem }. The manifest comes back with a problem too, so the row that says what is
        // wrong can still carry the plugin's name.
        function read(text, folder) {
            let raw;
            try {
                raw = TOML.parse(text);
            } catch (error) {
                return { manifest: manifestOf({}, folder), problem: `${FILE}: ${error.message}` };
            }
            const manifest = manifestOf(raw, folder);
            return { manifest, problem: problemOf(raw, folder, manifest) };
        }

        // macOS disks ignore case, so "Host" and "host" would be one folder while comparing as two ids.
        function idProblem(raw) {
            const id = String(raw ?? '');
            if (id !== id.toLowerCase()) return `plugin ids are lower case: "${id.toLowerCase()}", not "${id}"`;
            if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id) || id.includes('..')) {
                return `"${id}" is not a usable plugin id: lower case letters, digits, . _ - and at most 64 of them`;
            }
            return '';
        }

        // MARK: - Private
        function manifestOf(raw, folder) {
            const permissions = isTable(raw.permissions) ? raw.permissions : {};
            return {
                id: String(folder),
                name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : String(folder),
                version: typeof raw.version === 'string' ? raw.version : null,
                api: typeof raw.api === 'string' ? raw.api : null,
                requires: isTable(raw.requires) ? { ...raw.requires } : {},
                permissions: PERMISSION.PERMISSIONS.filter(({ id }) => Object.hasOwn(permissions, id)).map(
                    (permission) => ({
                        ...permission,
                        reason: String(permissions[permission.id]).trim(),
                    })
                ),
                urlSchemes: Array.isArray(raw['url-schemes']) ? [...new Set(raw['url-schemes'])] : [],
            };
        }

        function problemOf(raw, folder, manifest) {
            const id = String(folder);
            const idWrong = idProblem(id);
            if (idWrong) return idWrong;
            const unknown = Object.keys(raw).filter((key) => !FIELDS.has(key));
            if (unknown.length)
                return `${FILE} has ${unknown.map((key) => `"${key}"`).join(', ')}, which is not a manifest field`;
            if (typeof raw.id !== 'string' || !raw.id) return `${FILE} needs id = "${id}"`;
            if (raw.id !== id) return `${FILE} says id = "${raw.id}" but the folder is "${id}"; they must agree`;
            if (Object.hasOwn(raw, 'name') && (typeof raw.name !== 'string' || !raw.name.trim()))
                return 'name must be text';
            if (!VERSION.parse(raw.version))
                return `version must be written as "MAJOR.MINOR.PATCH", not ${JSON.stringify(raw.version)}`;
            if (!VERSION.parse(raw.api))
                return `api must be written as "MAJOR.MINOR.PATCH" (this deck speaks ${API}), not ${JSON.stringify(raw.api)}`;
            if (!VERSION.satisfies(API, raw.api)) return `needs api ${raw.api}, this deck speaks ${API}`;
            return requiresProblem(raw) || permissionsProblem(raw) || schemesProblem(raw, manifest);
        }

        function requiresProblem(raw) {
            if (!Object.hasOwn(raw, 'requires')) return '';
            if (!isTable(raw.requires)) return 'requires must be a [requires] table of plugin id = version';
            for (const [other, want] of Object.entries(raw.requires)) {
                const wrong = idProblem(other);
                if (wrong) return `requires ${other}: ${wrong}`;
                if (!VERSION.parse(want))
                    return `requires ${other} must be written as "MAJOR.MINOR.PATCH", not ${JSON.stringify(want)}`;
            }
            return '';
        }

        function permissionsProblem(raw) {
            if (!Object.hasOwn(raw, 'permissions')) return '';
            const example = '[permissions] table of name = "why it is needed", such as "system.main-process" = "…"';
            if (!isTable(raw.permissions)) return `permissions must be a ${example}`;
            const known = new Set(PERMISSION.PERMISSIONS.map(({ id }) => id));
            const unknown = Object.keys(raw.permissions).filter((id) => !known.has(id));
            if (unknown.length) {
                return `unknown permission ${unknown.map((id) => `"${id}"`).join(', ')}; there are ${[...known].map((id) => `"${id}"`).join(', ')}`;
            }
            const unexplained = Object.entries(raw.permissions).filter(
                ([, why]) => typeof why !== 'string' || !why.trim()
            );
            if (unexplained.length) {
                return `permission ${unexplained.map(([id]) => `"${id}"`).join(', ')} needs the reason it is asked for, as text`;
            }
            return '';
        }

        function schemesProblem(raw, manifest) {
            if (!Object.hasOwn(raw, 'url-schemes')) return '';
            const list = raw['url-schemes'];
            const example = 'url-schemes = ["https"], or ["*"] for every scheme';
            if (!Array.isArray(list) || !list.length) return `url-schemes must be a list of schemes, as ${example}`;
            const bad = list.filter(
                (scheme) => typeof scheme !== 'string' || (scheme !== SCHEME.EVERY && !SCHEME.SCHEME.test(scheme))
            );
            if (bad.length) {
                return `url-schemes: ${bad.map((scheme) => JSON.stringify(scheme)).join(', ')} is not a scheme; a scheme is lower case, as "https" or "my-app", with no ":"`;
            }
            const unplaced = list.filter((scheme) => SCHEME.NOT_PLACES.has(scheme));
            if (unplaced.length)
                return `url-schemes: ${unplaced.map((scheme) => `"${scheme}"`).join(', ')} is not a place; nothing opens it`;
            if (manifest.urlSchemes.includes(SCHEME.EVERY) && manifest.urlSchemes.length > 1) {
                return `url-schemes: "${SCHEME.EVERY}" already takes every scheme, so it stands alone`;
            }
            return '';
        }

        function isTable(value) {
            return !!value && typeof value === 'object' && !Array.isArray(value);
        }

        return { FILE, API, read, idProblem };
    }
);
