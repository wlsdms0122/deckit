const { CHIP_STYLE } = require('./chip.js');
const { keyboardSection } = require('./keyboard-section.js');
const { modSettingsSection } = require('./mod-settings-section.js');
const { modsSection } = require('./mods-section.js');
const { SECTION_STYLE } = require('./section.js');
const { tableOfContents } = require('./table-of-contents.js');
const { urlSchemesSection } = require('./url-schemes-section.js');

module.exports = {
    keywords: ['설정', '모드', 'settings', 'mods'],
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,

    start(deck) {
        const { ui, util } = deck;
        const APP_NAME = deck.about().name;

        const modIcons = new Map(); // mod id -> its icon, as the list was last drawn
        // mod id -> the keys a mod had as the Keyboard section last drew it running: a key map lists a mod's keys only
        // while it runs
        const drawnKeys = new Map();
        let shown = false;

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
        ui.addStyle(SECTION_STYLE + CHIP_STYLE);
        const page = ui.element('div', { className: 'settings-page' });
        const body = ui.element('div', { className: 'settings-body' });
        const mods = modsSection({
            ui,
            mods: deck.mods,
            everyScheme: deck.urlSchemes.everyScheme,
            util,
            appName: APP_NAME,
            onChange: redraw,
        });
        const modSettings = modSettingsSection({
            ui,
            modSettings: deck.modSettings,
            onFailure: mods.showNotice,
        });
        const urlSchemes = urlSchemesSection({ ui, urlSchemes: deck.urlSchemes, appName: APP_NAME });
        const keyboard = keyboardSection({ ui, keymap: deck.keymap });
        const sections = [mods, modSettings, urlSchemes, keyboard];
        const contents = tableOfContents({ ui, scroller: body, sections });

        body.append(...sections.map((section) => section.element));
        const title = ui.element('div', { className: 'settings-title', text: 'Settings' });
        ui.titleBar(title);
        page.append(title, body);
        // commands() can be asked before the first visit draws anything.
        modSettings.draw();

        deck.view({
            content: page,
            sidebar: contents.element,
            didAppear: () => {
                shown = true;
                redraw();
                contents.follow();
            },
            didDisappear: () => {
                shown = false;
                keyboard.stopRecording();
            },
        });
        deck.commands(commands);
        deck.mods.onChange(() => shown && redraw());

        // Each section changes only what changed in it: a row, a key being recorded and a field being typed in stay.
        // A mod starting or stopping keeps what its run that launched showed (deck's `launched`), so a restart reads as
        // one, not as a mod gone and back.
        function redraw() {
            const { found, running: now } = deck.mods.list();
            const listed = deck.keymap.list();
            const handlerLists = deck.urlSchemes.list();
            for (const mod of now)
                drawnKeys.set(
                    mod.id,
                    listed.filter(({ owner }) => owner === mod.id)
                );
            const restarting = found.filter((mod) => mod.launched).map((mod) => mod.launched);
            const running = [...now, ...restarting];
            // A new run may have registered some of its keys already: those are the key map's.
            const listedIds = new Set(listed.map(({ id }) => id));
            const shortcuts = [
                ...listed,
                ...restarting.flatMap(({ id }) => drawnKeys.get(id) || []).filter(({ id }) => !listedIds.has(id)),
            ];
            for (const mod of running) modIcons.set(mod.id, mod.icon);
            mods.draw({ found, running, shortcuts, handlerLists });
            modSettings.draw();
            urlSchemes.draw(handlerLists);
            keyboard.draw(shortcuts);
        }

        function commands() {
            return [
                ...sections.map((section) => ({
                    label: section.title,
                    icon: ui.icon('gear', { size: 16 }),
                    keywords: section.keywords,
                    run: () => showSection(section),
                })),
                ...modSettings.groups().map((group) => ({
                    group: modSettings.title,
                    label: group.name + ' Settings',
                    icon: modIcons.get(group.id) || ui.icon('sliders', { size: 16 }),
                    keywords: ['설정', 'settings', group.id, ...group.items.map((item) => item.label)],
                    run: () => {
                        deck.show();
                        showSettingsOf(group.id);
                    },
                })),
            ];
        }

        function showSection(section) {
            deck.show();
            requestAnimationFrame(() => contents.go(section));
        }

        async function showSettingsOf(id) {
            await modSettings.draw();
            requestAnimationFrame(() => {
                const card = modSettings.cardOf(id);
                if (!card) return;
                contents.reveal(modSettings, card);
                modSettings.highlight(card);
            });
        }
    },
};
