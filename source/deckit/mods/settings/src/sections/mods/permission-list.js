// The rules of a permission list. The Mods section adopts them once.
const PERMISSION_LIST_STYLE = `
    .settings-permissions { overflow: hidden; border: var(--deckit-border); border-radius: var(--deckit-radius-large); }
    .settings-permission {
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr);
        column-gap: 11px;
        padding: 10px 12px;
    }
    .settings-permission + .settings-permission { border-top: var(--deckit-border); }
    .settings-permission-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 7px;
        background: color-mix(in srgb, var(--deckit-accent) 16%, transparent);
        color: var(--deckit-accent);
    }
    .settings-permission-head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        column-gap: 8px;
        line-height: 1.45;
    }
    .settings-permission-name { font: 600 13.5px var(--deckit-font); }
    .settings-permission-id { overflow-wrap: anywhere; font: 11.5px var(--deckit-mono); opacity: 0.5; }
    .settings-permission-reason {
        margin-top: 2px;
        overflow-wrap: anywhere;
        font: var(--deckit-type-body);
        opacity: 0.85;
    }
    .settings-permission-description {
        margin-top: 4px;
        overflow-wrap: anywhere;
        font: var(--deckit-type-small);
        opacity: 0.5;
    }
    .settings-permission-unusable { margin-top: 4px; font: var(--deckit-type-small); color: var(--deckit-warn); }
`;

// The glyph each permission is drawn with, by its id; one Settings does not know is drawn as a permission.
const PERMISSION_ICONS = {
    'system.main-process': 'server',
    'system.files': 'fileText',
    'system.network': 'globe',
    'system.certificates': 'shieldCheck',
    'system.site-permissions': 'mic',
    'system.clipboard-read': 'copy',
    'system.clipboard-write': 'copy',
    'system.file-handlers': 'externalWindow',
    'system.overlay-windows': 'dockWindow',
    'system.notifications': 'bell',
    'system.global-keys': 'monitor',
    'deckit.mods': 'puzzle',
    'deckit.reach-mods': 'link',
    'deckit.system-services': 'sliders',
    'deckit.app-keys': 'window',
    'deckit.shell-keys': 'keyboard',
    'deckit.styles': 'eye',
    'deckit.fonts': 'pencil',
};
const PERMISSION_ICON = 'info';

// The row of a mod that asks to run in the background, drawn with its reason.
const BACKGROUND = {
    icon: 'clock',
    name: 'In the background',
    description: 'It starts with the app and runs while the app is open.',
};

// The permissions a mod asks for: each one's name, id, the mod's reason and what it lets the mod do, and whether this
// app gives it. One this app does not give has only its id and the reason. `background`, the mod's reason to run in
// the background, is a row first where it has one.
function permissionList({ ui, permissions, background = null }) {
    const element = ui.element('div', { className: 'settings-permissions' });

    if (background) element.append(row({ ...BACKGROUND, reason: background }));
    for (const permission of permissions) element.append(permissionRow(permission));
    return { element };

    function permissionRow(permission) {
        const icon = PERMISSION_ICONS[permission.id] || PERMISSION_ICON;
        const drawn = row({ ...permission, icon });
        if (permission.usable === false)
            drawn.lastChild.append(
                ui.element('div', {
                    className: 'settings-permission-unusable',
                    text: 'This app does not give it, so the mod runs without it.',
                })
            );
        return drawn;
    }

    function row({ icon: glyph, name, id, reason, description }) {
        const element = ui.element('div', { className: 'settings-permission' });
        const icon = ui.element('div', { className: 'settings-permission-icon' });
        const words = ui.element('div');
        const head = ui.element('div', { className: 'settings-permission-head' });

        icon.innerHTML = ui.icon(glyph, { size: 15 });
        if (name) head.append(ui.element('span', { className: 'settings-permission-name', text: name }));
        if (id) head.append(ui.element('span', { className: 'settings-permission-id', text: id }));
        words.append(head, ui.element('div', { className: 'settings-permission-reason', text: reason }));
        if (description)
            words.append(ui.element('div', { className: 'settings-permission-description', text: description }));
        element.append(icon, words);
        return element;
    }
}

module.exports = { PERMISSION_LIST_STYLE, permissionList };
