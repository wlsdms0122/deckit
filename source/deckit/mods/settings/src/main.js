const { TIER, matchFields } = require('deckit-sdk/match');
const PATH = require('deckit-sdk/path');
const { activitySection } = require('./sections/activity/activity-section.js');
const { CHIP_STYLE } = require('./chip/chip.js');
const { generalSection } = require('./sections/general/general-section.js');
const { HANDLER_LIST_STYLE } = require('./sections/handler-list/handler-list.js');
const { interfacesSection } = require('./sections/interfaces/interfaces-section.js');
const { keyboardSection } = require('./sections/keyboard/keyboard-section.js');
const { modSettingsSection } = require('./sections/mod-settings/mod-settings-section.js');
const { modsSection } = require('./sections/mods/mods-section.js');
const { SECTION_STYLE } = require('./sections/section/section.js');
const { tableOfContents } = require('./table-of-contents/table-of-contents.js');
const { urlSchemesSection } = require('./sections/url-schemes/url-schemes-section.js');

// The system's services Settings draws and changes, each by the name it is held under while it is connected.
const SERVICES = {
    keys: 'deckit/keys',
    urls: 'deckit/urls',
    configuration: 'deckit/configuration',
    commands: 'deckit/commands',
    packages: 'deckit/packages',
};
// Where the sidebar's width and fold are kept, as the person leaves them.
const SIDEBAR = 'sidebar';

class Settings {
    // What attach has put on screen for the command and reopen() to reach, while it is attached: `openWindow()` opens
    // Settings' window, or orders it front where it is open.
    screen = null;

    // The command its manifest declares to `deckit/commands` is taken from the exports for its id, and runs on the
    // window, opening it where it is closed, failing, saying so, while Settings is not attached.
    start(deckit) {
        deckit.exports.register({
            connect: () => ({
                runCommand: async (id, args) => {
                    if (id !== 'show-settings-of') throw new Error(`Settings has no command ${id}`);
                    if (!this.screen) throw new Error('Settings has no window to open');
                    await this.screen.showSettingsOf(args ?? {});
                    return null;
                },
            }),
        });
    }

    attach(shell, deckit, { mainProcess }) {
        const { ui } = shell;
        const { name: APP_NAME, home } = deckit.about();
        const tildify = (path) => PATH.tildify(path, home);

        // name in SERVICES -> its exports while it is connected
        const services = { keys: null, urls: null, configuration: null, commands: null, packages: null };
        let shown = false;
        let drawing = 0;
        let listed = { found: [], running: [], interfaces: [] }; // what deckit.mods.list() last answered

        // In every rule of this mod, `line-height` comes after `font`: the shorthand resets it.
        ui.addStyle(`
            .settings-page {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                overflow: hidden;
                color: var(--deckit-text);
                font: var(--deckit-type-medium);
            }
            .settings-title {
                display: flex;
                align-items: center;
                flex: 0 0 auto;
                padding: 10px 14px;
                font: 700 var(--deckit-type-large);
            }
            .settings-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 14px 16px; }
        `);
        ui.addStyle(SECTION_STYLE + CHIP_STYLE + HANDLER_LIST_STYLE);
        const page = ui.element('div', { className: 'settings-page' });
        const body = ui.element('div', { className: 'settings-body' });
        const mods = modsSection({
            ui,
            mods: deckit.mods,
            mainProcess,
            packages: () => services.packages,
            pins: shell.mods,
            dropDestination: shell.dropDestination,
            dialogs: shell.dialogs,
            reveal: shell.reveal,
            tildify,
            appName: APP_NAME,
            onChange: redraw,
        });
        const sources = new Map(); // connection -> the buttons its mod set
        const modSettings = modSettingsSection({
            ui,
            theme: shell.theme,
            configuration: () => services.configuration,
            sources,
            nameOf: (id) => listed.found.find((mod) => mod.id === id)?.name || id,
        });
        const urlSchemes = urlSchemesSection({ ui, urls: () => services.urls, appName: APP_NAME, onChange: redraw });
        const interfaces = interfacesSection({ ui, mods: deckit.mods });
        const activity = activitySection({ ui, mods: deckit.mods, onInterfaces: () => contents.go(interfaces) });
        const general = generalSection({ ui, theme: shell.theme, fonts: shell.fonts });
        const keyboard = keyboardSection({
            ui,
            keys: () => services.keys,
            shellKeys: shell.keys,
            appName: APP_NAME,
            onChange: redraw,
        });
        const sections = [mods, activity, general, modSettings, urlSchemes, interfaces, keyboard];
        const contents = tableOfContents({ ui, scroller: body, sections });

        body.append(...sections.map((section) => section.element));
        const title = ui.element('div', { className: 'settings-title', text: 'Settings' });
        ui.titleBar(title);
        page.append(title, body);
        // A mod's settings can be asked for by its command before the first visit draws anything.
        modSettings.draw();
        deckit.exports.register('settings/buttons', {
            connect: (connection) => ({
                setButtons: (buttons) => {
                    sources.set(connection, buttons);
                    modSettings.draw();
                },
            }),
            disconnect: (connection) => {
                sources.delete(connection);
                modSettings.draw();
            },
        });
        // A service connected or gone changes what its section can draw.
        for (const [name, named] of Object.entries(SERVICES))
            deckit.dependencies.onConnect(named, (service) => {
                services[name] = service;
                if (name === 'configuration') modSettings.draw();
                else if (shown) redraw();
                return () => {
                    services[name] = null;
                    if (name === 'configuration') modSettings.draw();
                    else if (shown) redraw();
                };
            });

        // The table of contents beside the sections; a key being recorded stops as the keyboard leaves the window.
        const split = ui.splitView({
            sidebar: contents.element,
            content: page,
            ...deckit.storage.values.get(SIDEBAR, {}),
            onChange: (kept) => deckit.storage.values.set(SIDEBAR, kept),
        });
        const openWindow = () =>
            shell.windows.open({
                name: 'main',
                content: split.element,
                didAppear: () => {
                    shown = true;
                    redraw();
                    contents.follow();
                },
                didResignKey: () => keyboard.stopRecording(),
                didDisappear: () => (shown = false),
            });
        openWindow();
        deckit.dependencies.onConnect('switcher/actions', (quickSwitcher) =>
            quickSwitcher.setActions({
                list: () => [
                    ...sections.map((section, index) => ({
                        label: section.title,
                        keywords: section.keywords,
                        value: { action: 'show-section', index },
                    })),
                    {
                        label: "Show a Mod's Settings",
                        keywords: ['설정', 'settings'],
                        opens: true,
                        value: { action: 'show-settings-of' },
                    },
                ],
                search: (query, within) =>
                    within?.action === 'show-settings-of'
                        ? settingsOf(query).map(({ value, title }) => ({
                              label: title,
                              value: { ...within, mod: value },
                          }))
                        : [],
                run: async ({ action, index, mod }) => {
                    if (action === 'show-section') {
                        openWindow();
                        body.ownerDocument.defaultView.requestAnimationFrame(() => contents.go(sections[index]));
                    } else await showSettingsOf({ mod }, { ready: openWindow });
                },
            })
        );
        deckit.mods.onChange(() => shown && redraw());
        mainProcess?.onChange(() => shown && redraw());
        // Fonts set elsewhere come as a new theme, which a mod's setting left unset may inherit.
        shell.theme.onChange(() => {
            if (!shown) return;
            general.draw();
            modSettings.draw();
        });
        this.screen = { openWindow, showSettingsOf: (args) => showSettingsOf(args, { ready: openWindow }) };

        // Each section changes only what changed in it: a row, a key being recorded and a field being typed in stay.
        // A mod starting or stopping keeps what its run that launched showed (deckit.mods.list()'s `launched`), so a
        // restart reads as one, not as a mod gone and back. A later drawing that starts while this one reads the
        // services, or how the mods' main process modules are, draws instead.
        async function redraw() {
            const turn = ++drawing;
            const [keys, urls, configured, commands, answered] = await Promise.all([
                keyboard.read(),
                urlSchemes.read(),
                refusedBy('configuration'),
                refusedBy('commands'),
                deckit.mods.list(),
            ]);
            if (turn !== drawing) return;
            const failures = await failuresOf(answered.found);
            if (turn !== drawing) return;
            listed = answered;
            const { shortcuts } = keys;
            const { schemes } = urls;
            const refused = [
                ...commands,
                ...configured,
                ...keys.refused.map((one) => ({ ...one, interface: SERVICES.keys })),
                ...urls.refused.map((one) => ({ ...one, interface: SERVICES.urls })),
            ];
            const { found, running: now, interfaces: interfaceQueues } = listed;
            const restarting = found.filter((mod) => mod.launched).map((mod) => mod.launched);
            const running = [...now, ...restarting];
            mods.draw({ found, running, shortcuts, schemes, refused, failures });
            activity.draw(listed);
            modSettings.draw();
            urlSchemes.draw(schemes);
            interfaces.draw(interfaceQueues);
            general.draw();
            keyboard.draw(shortcuts);
        }

        // Why the main process modules of each mod of `found` that did not start did not, by its id; none where the
        // host runs no main process modules.
        async function failuresOf(found) {
            if (!mainProcess) return new Map();
            const states = await Promise.all(found.map((mod) => mainProcess.statusOf(mod.id)));
            return new Map(found.map((mod, index) => [mod.id, states[index]?.failure || null]));
        }

        // What the service held as `name` left out of what the mods declare to it, as its `list` answers them, each
        // with the interface; none while it is not connected or cannot be read.
        async function refusedBy(name) {
            if (!services[name]) return [];
            try {
                const { refused } = await services[name].list();
                return refused.map((one) => ({ ...one, interface: SERVICES[name] }));
            } catch (error) {
                console.warn(`[settings] could not read what ${SERVICES[name]} left out`, error);
                return [];
            }
        }

        // The mods with settings as they were last drawn, ranked for `partial`, matched by their name, id and the
        // labels of their settings.
        function settingsOf(partial) {
            const candidates = modSettings.groups().map((group) => ({
                value: group.id,
                title: group.name,
                keywords: [group.id, ...group.items.map((item) => item.label).filter(Boolean)],
            }));
            if (!partial.trim()) return candidates;
            return candidates
                .map((candidate) => ({
                    candidate,
                    found: matchFields(
                        [
                            { text: candidate.title, name: true },
                            { text: candidate.keywords.join(' '), weight: 0.8, cap: TIER.INSIDE },
                        ],
                        partial
                    ),
                }))
                .filter(({ found }) => found)
                .sort((left, right) => right.found.tier - left.found.tier || right.found.score - left.found.score)
                .map(({ candidate }) => candidate);
        }

        // Asked of the mods with settings as they are drawn now. `ready()` is told once the mod is found to have
        // settings.
        async function showSettingsOf({ mod: id }, { ready = () => {} } = {}) {
            await modSettings.draw();
            if (!modSettings.groups().some((group) => group.id === id)) throw new Error(`${id} has no settings`);
            ready();
            body.ownerDocument.defaultView.requestAnimationFrame(() => {
                const card = modSettings.cardOf(id);
                if (!card) return;
                contents.reveal(modSettings, card);
                modSettings.highlight(card);
            });
        }
    }

    // Its Dock item pressed while its window is closed.
    reopen() {
        this.screen?.openWindow();
    }

    detach() {
        this.screen = null;
    }
}

module.exports = Settings;
