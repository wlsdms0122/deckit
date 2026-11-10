const { TIER, matchFields } = require('deckit-sdk/match');
const { openAddress } = require('./address/open-address.js');
const { switcher } = require('./switcher/switcher.js');

// What a person asks of deckit itself, as commands and as the switcher's actions: an address to open, a mod or the app
// to restart, deckit's folders, and what is running. It has no view.
class Deckit {
    // The commands its manifest declares to `deckit/commands`, run from the exports for its id.
    start(deckit) {
        const APP_NAME = deckit.about().name;
        // An address opens through `deckit/urls`; one asked while it is not connected is logged.
        let urls = null;
        deckit.dependencies.onConnect('deckit/urls', (connected) => {
            urls = connected;
            return () => (urls = null);
        });
        const address = openAddress({
            open: async (url) => {
                if (urls) return urls.open(url);
                console.warn(`[deckit] ${url} did not open: deckit/urls is not connected`);
                return false;
            },
        });
        const STATES = { launching: 'Starting', running: 'Running', notRunning: 'Not running' };

        const commands = {
            'open-address': ({ address: given }) => address.go(given),
            'restart-mod': ({ mod }) => restartMod(mod),
            'restart-app': () => deckit.mods.restart(),
            'show-mods-folder': () => reveal('mods'),
            'show-data-folder': () => reveal('data'),
            'show-log': () => reveal('log'),
            'copy-version': copyVersion,
        };
        deckit.exports.register({
            connect: () => ({
                runCommand: async (id, args) => {
                    if (!Object.hasOwn(commands, id)) throw new Error(`Deckit has no command ${id}`);
                    await commands[id](args ?? {});
                },
            }),
        });

        // What the switcher's actions search and do, for attach().
        this.actions = { appName: APP_NAME, address, modsFor, versions, does: commands };

        // One of deckit's places in `deckit.mods.folders()`, shown where it lies by the shell's reveal, which attach()
        // keeps.
        const reveal = async (place) => this.reveal((await deckit.mods.folders())[place]);

        // Only a version About lists is copied.
        async function copyVersion({ version }) {
            if (!versions().includes(version)) throw new Error(`${version} is no version of what is running`);
            await deckit.clipboard.writeText(version);
        }

        // One not running is launched. One that does not restart says why: one that did not load, or one stopping. A
        // refusal is told in a notice.
        async function restartMod(id) {
            const [list, runs] = await Promise.all([deckit.mods.list(), deckit.mods.runs()]);
            const entry = list.find((each) => each.id === id);
            if (!entry) throw new Error(`There is no mod ${id}`);
            if (entry.refusal) throw new Error(`${id} did not load: ${entry.refusal.message}`);
            const run = runs.find((each) => each.id === id);
            if (run?.state === 'terminating') throw new Error(`${entry.mod.name} is stopping`);
            return deckit.mods.relaunch(id);
        }

        // Every mod found, each with its state, ranked for `partial` by its name and id.
        async function modsFor(partial) {
            const [list, runs] = await Promise.all([deckit.mods.list(), deckit.mods.runs()]);
            const candidates = list.map((entry) => {
                const state = runs.find((run) => run.id === entry.id)?.state ?? 'notRunning';
                return {
                    value: entry.id,
                    title: entry.mod?.name ?? entry.id,
                    hint: entry.refusal ? entry.refusal.message : state === 'terminating' ? 'Stopping' : STATES[state],
                };
            });
            if (!partial.trim()) return candidates;
            return candidates
                .map((candidate) => ({
                    candidate,
                    found: matchFields(
                        [
                            { text: candidate.title, name: true },
                            { text: candidate.value, weight: 0.8, cap: TIER.INSIDE },
                        ],
                        partial
                    ),
                }))
                .filter(({ found }) => found)
                .sort((left, right) => right.found.tier - left.found.tier || right.found.score - left.found.score)
                .map(({ candidate }) => candidate);
        }

        function versions() {
            const about = deckit.about();
            return [
                about.app,
                `deckit ${about.version} (${about.source})`,
                ...about.engines.map((engine) => `${engine.name} ${engine.version}`),
            ];
        }
    }

    attach(shell, deckit) {
        this.reveal = shell.reveal;
        const actions = switcher(this.actions);
        deckit.dependencies.onConnect('switcher/actions', (quickSwitcher) => quickSwitcher.setActions(actions));
    }
}

module.exports = Deckit;
