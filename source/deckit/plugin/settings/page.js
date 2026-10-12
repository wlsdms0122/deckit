Deckit.register({
    keywords: ['설정', '플러그인', 'settings', 'plugins'],
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,

    make({ ui, host, util }) {
        const APP_NAME = host.about().name;

        const pluginIcons = new Map(); // plugin id -> its icon, as the list was last drawn

        // In every rule of this plugin, `line-height` comes after `font`: the shorthand resets it.
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
            .settings-title { flex: 0 0 auto; padding: 12px 14px 8px; font: 700 var(--deckit-type-large); }
            .settings-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 14px 16px; }
        `);
        ui.addStyle(SECTION_STYLE + CHIP_STYLE);
        const page = ui.element('div', { className: 'settings-page' });
        const body = ui.element('div', { className: 'settings-body' });
        const plugins = pluginsSection({ ui, host, util, appName: APP_NAME, onChange: redraw });
        const pluginSettings = pluginSettingsSection({ ui, host, onFailure: plugins.showNotice });
        const urlSchemes = urlSchemesSection({ ui, host, appName: APP_NAME });
        const keyboard = keyboardSection({ ui, host });
        const sections = [plugins, pluginSettings, urlSchemes, keyboard];
        const contents = tableOfContents({ ui, scroller: body, sections });

        body.append(...sections.map((section) => section.element));
        page.append(ui.element('div', { className: 'settings-title', text: 'Settings' }), body);
        // commands() can be asked before the first visit draws anything.
        pluginSettings.draw();

        return {
            content: page,
            sidebar: contents.element,
            didAppear: () => {
                redraw();
                contents.follow();
            },
            didDisappear: () => keyboard.stopRecording(),
            commands,
        };

        function redraw() {
            const { installed: onDisk, running } = host.plugins.list();
            for (const plugin of running) pluginIcons.set(plugin.id, plugin.icon);
            plugins.draw({ onDisk, running });
            pluginSettings.draw();
            urlSchemes.draw();
            keyboard.draw();
        }

        function commands() {
            return [
                ...sections.map((section) => ({
                    label: section.title,
                    icon: ui.icon('gear', { size: 16 }),
                    keywords: section.keywords,
                    run: () => showSection(section),
                })),
                ...pluginSettings.groups().map((group) => ({
                    group: pluginSettings.title,
                    label: group.name + ' Settings',
                    icon: pluginIcons.get(group.id) || ui.icon('sliders', { size: 16 }),
                    keywords: ['설정', 'settings', group.id, ...group.items.map((item) => item.label)],
                    run: () => {
                        host.show();
                        showSettingsOf(group.id);
                    },
                })),
            ];
        }

        function showSection(section) {
            host.show();
            requestAnimationFrame(() => contents.go(section));
        }

        async function showSettingsOf(id) {
            await pluginSettings.draw();
            requestAnimationFrame(() => {
                const card = pluginSettings.cardOf(id);
                if (!card) return;
                contents.reveal(pluginSettings, card);
                pluginSettings.highlight(card);
            });
        }
    },
});
