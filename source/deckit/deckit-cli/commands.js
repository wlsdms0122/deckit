DeckitModule.define(
    'cli/commands',
    {
        uses: [
            'deckit/config',
            'deckit/service/home',
            'deckit/service/storage',
            'deckit/service/plugin/package/manifest',
            'deckit/service/plugin/package/folder',
            'deckit/service/plugin/package/install',
            'deckit/service/plugin/package/remove',
            'deckit/service/plugin/package/model/permission',
        ],
        provides: ['run'],
        runs: 'node',
    },
    (CONFIG, HOME, STORAGE, MANIFEST, FOLDER, INSTALL, REMOVE, PERMISSION) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        // An option { name: 'meaning' } is a flag; { name: ['<value>', 'meaning'] } takes a value.
        const COMMANDS = {
            where: {
                about: "deckit's folder, and where plugins are installed",
                run: () => {
                    say(HOME.folder);
                    say(HOME.plugins);
                },
            },
            list: {
                about: 'the installed plugins: each version, or why it would not load',
                run: () => {
                    for (const name of INSTALL.folders()) {
                        const { manifest, problem } = FOLDER.loadable(path.join(HOME.plugins, name));
                        say(
                            problem
                                ? `${name.padEnd(12)} not loaded: ${problem}`
                                : `${name.padEnd(12)} ${manifest.version}`
                        );
                    }
                    say('→ ' + HOME.plugins);
                },
            },
            install: {
                operands: '<folder>...',
                least: 1,
                about: 'plugin folders, held to what the app loads, installed',
                run: ({ operands }) => {
                    const found = operands.map((folder) => {
                        const { manifest, problem } = FOLDER.loadable(folder);
                        if (problem) throw new Error(`${folder}: ${problem}`);
                        const copy = INSTALL.copyProblem(folder);
                        if (copy) throw new Error(`${folder}: ${copy}`);
                        return { folder, manifest };
                    });
                    for (const { folder, manifest } of found) {
                        INSTALL.install(folder);
                        say(`installed  ${manifest.id.padEnd(12)} ${manifest.version}`);
                    }
                    say('→ ' + HOME.plugins);
                    restart();
                },
            },
            remove: {
                operands: '<id>',
                least: 1,
                most: 1,
                options: { data: 'what it stored too' },
                about: 'an installed plugin taken away',
                run: ({ operands: [id], options }) => {
                    const removed = REMOVE.remove(id, { data: !!options.data });
                    say(`removed    ${id}${removed.data ? ', and what it stored' : ''}`);
                },
            },
            ship: {
                about: 'the plugins the app ships, by the rule: updated, new ones installed, ones the person removed left out',
                run: () => report(INSTALL.installShipped()),
            },
            restore: {
                operands: '<id>...',
                least: 1,
                about: 'plugins the app ships, brought back whatever was decided before',
                run: ({ operands }) => report(INSTALL.installShipped({ only: operands })),
            },
            new: {
                operands: '<id>',
                least: 1,
                most: 1,
                options: { in: ['<folder>', 'where it is started (required)'], 'main-process': 'with a main process module' },
                about: 'a plugin started in <folder>/<id>: its manifest and an entry that runs',
                run: ({ operands: [id], options }) => start(id, options),
            },
            manifest: {
                operands: '<folder> [<field>]',
                least: 1,
                most: 2,
                about: 'a plugin folder held to what the app loads: a field of its manifest, "requires" (ids, a line each), "json" (all of it), or "problem"',
                run: ({ operands: [folder, field] }) => {
                    const { manifest, problem } = FOLDER.loadable(folder);
                    if (field === 'problem') return problem && say(problem);
                    if (problem) throw new Error(`${folder}: ${problem}`);
                    if (!field || field === 'json') say(JSON.stringify(manifest));
                    else if (field === 'requires') for (const id of Object.keys(manifest.requires)) say(id);
                    else if (manifest[field] != null) say(String(manifest[field]));
                },
            },
            data: {
                operands: '<id>',
                least: 1,
                most: 1,
                about: 'what a plugin stored, counted: "<count> <capped> <hidden>"',
                run: async ({ operands: [id] }) => {
                    const { count, capped, hidden } = await STORAGE.count(id);
                    say(`${count} ${capped} ${hidden}`);
                },
            },
        };

        // MARK: - Initializer
        // MARK: - Public
        // What throws here is a rule or a usage error for the person to act on, so only its message is printed.
        async function run({ command, args = [] } = {}) {
            const declared = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : null;
            if (!declared) {
                process.stderr.write((command ? `unknown command: ${command}\n\n` : '') + usage());
                return 1;
            }
            try {
                await declared.run(read(command, declared, args));
                return 0;
            } catch (error) {
                process.stderr.write(String(error.message || error) + '\n');
                return 1;
            }
        }

        // MARK: - Private
        function say(line) {
            process.stdout.write(line + '\n');
        }

        function restart() {
            say(`restart ${CONFIG.name} to pick them up`);
        }

        function report(outcomes) {
            for (const { id, outcome, version } of outcomes) {
                if (outcome === 'installed') say(`installed  ${id.padEnd(12)} ${version}`);
                else if (outcome === 'left out') say(`left out   ${id} (removed)`);
                else say(`dropped    ${id} (no longer shipped)`);
            }
            say('→ ' + HOME.plugins);
            if (outcomes.some(({ outcome }) => outcome === 'installed')) restart();
        }

        // A folder named for the id, which is held to the manifest's rule for one; the folder may be renamed after.
        function start(id, options) {
            if (!options.in) throw new Error('new: --in <folder>, where it is started');
            const wrong = MANIFEST.idProblem(id);
            if (wrong) throw new Error(wrong);
            if (CONFIG.ship.some((folder) => FOLDER.idOf(folder) === id))
                throw new Error(`"${id}" is already a plugin the app ships`);
            const folder = path.join(options.in, id);
            if (fs.existsSync(folder)) throw new Error('already there: ' + folder);
            const name = id
                .split(/[._-]+/)
                .filter(Boolean)
                .map((word) => word[0].toUpperCase() + word.slice(1))
                .join(' ');
            const template = path.join(__dirname, 'template', options['main-process'] ? 'main-process' : 'plain');
            const manifest = [
                `id = "${id}"`,
                `name = "${name}"`,
                'version = "1.0.0"',
                `api = "${MANIFEST.API}"`,
                'main = "main.js"',
            ];
            // The value is the reason Settings shows whoever installs the plugin.
            if (options['main-process'])
                manifest.push('', '[permissions]', `"${PERMISSION.MAIN_PROCESS}" = "Answers ping from the plugin."`);
            fs.mkdirSync(folder, { recursive: true });
            fs.writeFileSync(path.join(folder, 'manifest.toml'), manifest.join('\n') + '\n');
            // Placeholders rather than template strings: an entry is full of ${…} of its own.
            for (const file of fs.readdirSync(template)) {
                const text = fs.readFileSync(path.join(template, file), 'utf8');
                fs.writeFileSync(path.join(folder, file), text.replace(/@@NAME@@/g, name).replace(/@@ID@@/g, id));
            }
            say('wrote ' + folder);
            for (const file of fs.readdirSync(folder).sort()) say('  ' + file);
        }

        function written(name, { operands, options = {} }) {
            return [
                name,
                operands,
                ...Object.entries(options).map(
                    ([option, said]) => `[--${option}${Array.isArray(said) ? ' ' + said[0] : ''}]`
                ),
            ]
                .filter(Boolean)
                .join(' ');
        }

        function usage() {
            return [
                'deckit-cli: the plugins of an app that embeds deckit',
                '',
                '  deckit-cli [--app <app module>]... <command>',
                '',
                ...Object.entries(COMMANDS).flatMap(([name, command]) => [
                    '  ' + written(name, command),
                    '      ' + command.about,
                    ...Object.entries(command.options || {}).map(
                        ([option, said]) => `      --${option}: ${Array.isArray(said) ? said[1] : said}`
                    ),
                ]),
                '',
            ].join('\n');
        }

        function read(name, { options = {}, least = 0, most = null }, args) {
            const operands = [];
            const given = {};
            for (let index = 0; index < args.length; index++) {
                const arg = args[index];
                if (!arg.startsWith('--')) {
                    operands.push(arg);
                    continue;
                }
                const option = arg.slice(2);
                if (!Object.hasOwn(options, option)) {
                    throw new Error(
                        `${name} takes no ${arg}${option === 'app' ? ' (it goes before the command)' : ''}`
                    );
                }
                if (!Array.isArray(options[option])) {
                    given[option] = true;
                    continue;
                }
                const value = args[index + 1];
                if (value == null || value.startsWith('--')) throw new Error(`${arg} needs ${options[option][0]}`);
                given[option] = value;
                index++;
            }
            if (operands.length < least || (most != null && operands.length > most)) {
                throw new Error(`usage: deckit-cli ${written(name, COMMANDS[name])}`);
            }
            return { operands, options: given };
        }

        return { run };
    }
);
