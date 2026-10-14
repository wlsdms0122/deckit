DeckitModule.define(
    'deck/service/mod/manifest',
    {
        uses: ['deck/module/toml', 'deck/module/version', 'deck/service/mod/permission'],
        provides: ['FILE', 'API', 'define', 'read', 'of', 'idProblem'],
        runs: 'any',
    },
    (TOML, VERSION, PERMISSION) => {
        // MARK: - Property
        const FILE = 'manifest.toml';
        // The version of the mod contract, which a manifest's `api` is written against.
        const API = '1.0.0';
        const FIELDS = new Set(['id', 'name', 'version', 'api', 'main', 'requires', 'optional', 'permissions']);
        const added = new Map(); // a field a layer reads -> { key, read, problemOf }
        let reading = false; // a manifest has been read

        // MARK: - Initializer
        // MARK: - Public
        // A field a layer reads, defined before any manifest is read: the manifest holds `read(raw)` under `key`, and
        // `problemOf(raw, value)` says what is wrong with one the mod wrote, or ''.
        function define(field, { key, read: readField, problemOf: problemOfField }) {
            if (reading) throw new Error(`[deckit] the manifest field ${field} is defined after manifests were read`);
            if (FIELDS.has(field) || added.has(field))
                throw new Error(`[deckit] the manifest field ${field} is defined`);
            added.set(field, { key, read: readField, problemOf: problemOfField });
        }

        // Returns { manifest, problem }. The manifest comes back with a problem too, so the row that says what is
        // wrong can still carry the mod's name; `fallback` stands for its id where the manifest gives none.
        function read(text, fallback) {
            reading = true;
            let raw;
            try {
                raw = TOML.parse(text);
            } catch (error) {
                return { manifest: manifestOf({}, fallback), problem: `${FILE}: ${error.message}` };
            }
            const manifest = manifestOf(raw, fallback);
            return { manifest, problem: problemOf(raw, manifest) };
        }

        // What a manifest says, from a mod as deck found it, which carries its manifest among other things.
        function of(mod) {
            const { id, name, version, api, main, requires, optional, permissions } = mod;
            const fields = Object.fromEntries([...added.values()].map(({ key }) => [key, mod[key]]));
            return { id, name, version, api, main, requires, optional, permissions, ...fields };
        }

        // Each mod keeps its data in a folder named by its id, and macOS disks ignore case: "Note" and "note"
        // would be one folder while comparing as two ids.
        function idProblem(raw) {
            const id = String(raw ?? '');
            if (id !== id.toLowerCase()) return `mod ids are lower case: "${id.toLowerCase()}", not "${id}"`;
            if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id) || id.includes('..')) {
                return `"${id}" is not a usable mod id: lower case letters, digits, . _ - and at most 64 of them`;
            }
            return '';
        }

        // MARK: - Private
        function manifestOf(raw, fallback) {
            const permissions = isTable(raw.permissions) ? raw.permissions : {};
            const id = typeof raw.id === 'string' && raw.id ? raw.id : String(fallback);
            return {
                id,
                name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : id,
                version: typeof raw.version === 'string' ? raw.version : null,
                api: typeof raw.api === 'string' ? raw.api : null,
                main: typeof raw.main === 'string' ? raw.main : null,
                requires: isTable(raw.requires) ? { ...raw.requires } : {},
                optional: isTable(raw.optional) ? { ...raw.optional } : {},
                permissions: PERMISSION.all()
                    .filter(({ id }) => Object.hasOwn(permissions, id))
                    .map((permission) => ({ ...permission, reason: String(permissions[permission.id]).trim() })),
                ...Object.fromEntries(
                    [...added].map(([field, { key, read: readField }]) => [key, readField(raw[field])])
                ),
            };
        }

        function problemOf(raw, manifest) {
            const unknown = Object.keys(raw).filter((key) => !FIELDS.has(key) && !added.has(key));
            if (unknown.length)
                return `${FILE} has ${unknown.map((key) => `"${key}"`).join(', ')}, which is not a manifest field`;
            if (typeof raw.id !== 'string' || !raw.id) return `${FILE} needs an id, as id = "my-mod"`;
            const idWrong = idProblem(raw.id);
            if (idWrong) return idWrong;
            if (Object.hasOwn(raw, 'name') && (typeof raw.name !== 'string' || !raw.name.trim()))
                return 'name must be text';
            if (!VERSION.parse(raw.version))
                return `version must be written as "MAJOR.MINOR.PATCH", not ${JSON.stringify(raw.version)}`;
            if (!VERSION.parse(raw.api))
                return `api must be written as "MAJOR.MINOR.PATCH" (this deck speaks ${API}), not ${JSON.stringify(raw.api)}`;
            if (!VERSION.satisfies(API, raw.api)) return `needs api ${raw.api}, this deck speaks ${API}`;
            return (
                mainProblem(raw) ||
                dependencyProblem(raw, 'requires') ||
                dependencyProblem(raw, 'optional') ||
                bothProblem(raw) ||
                permissionsProblem(raw) ||
                addedProblem(raw, manifest)
            );
        }

        // A path inside the mod's folder, "/" separated; whether a file is there is the folder's to say.
        function mainProblem(raw) {
            const example = 'main = "dist/main.js"';
            if (typeof raw.main !== 'string' || !raw.main.trim())
                return `${FILE} needs main, the file deck runs, as ${example}`;
            const parts = raw.main.split('/');
            if (raw.main.startsWith('/') || raw.main.includes('\\') || parts.includes('..'))
                return `main must be a path inside the mod's folder, as ${example}, not ${JSON.stringify(raw.main)}`;
            return '';
        }

        // `requires`: what it runs only with. `optional`: what it uses when it is there, and runs without.
        function dependencyProblem(raw, field) {
            if (!Object.hasOwn(raw, field)) return '';
            if (!isTable(raw[field])) return `${field} must be a [${field}] table of mod id = version`;
            for (const [other, want] of Object.entries(raw[field])) {
                const wrong = idProblem(other);
                if (wrong) return `${field} ${other}: ${wrong}`;
                if (!VERSION.parse(want))
                    return `${field} ${other} must be written as "MAJOR.MINOR.PATCH", not ${JSON.stringify(want)}`;
            }
            return '';
        }

        function bothProblem(raw) {
            const both = Object.keys(isTable(raw.optional) ? raw.optional : {}).filter(
                (id) => isTable(raw.requires) && Object.hasOwn(raw.requires, id)
            );
            return both.length ? `${both.join(', ')} is in both [requires] and [optional]` : '';
        }

        function permissionsProblem(raw) {
            if (!Object.hasOwn(raw, 'permissions')) return '';
            const example = '[permissions] table of name = "why it is needed", such as "deckit.mods" = "…"';
            if (!isTable(raw.permissions)) return `permissions must be a ${example}`;
            const known = new Set(PERMISSION.all().map(({ id }) => id));
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

        function addedProblem(raw, manifest) {
            for (const [field, { key, problemOf: problemOfField }] of added) {
                const problem = Object.hasOwn(raw, field) ? problemOfField(raw[field], manifest[key]) : '';
                if (problem) return problem;
            }
            return '';
        }

        function isTable(value) {
            return !!value && typeof value === 'object' && !Array.isArray(value);
        }

        return { FILE, API, define, read, of, idProblem };
    }
);
