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
    .settings-permission-means {
        margin-top: 4px;
        overflow-wrap: anywhere;
        font: var(--deckit-type-small);
        opacity: 0.5;
    }
`;

// The permissions a mod asks for: each one's name, id, the mod's reason and what it lets the mod do.
function permissionList({ ui, permissions }) {
    const element = ui.element('div', { className: 'settings-permissions' });

    for (const permission of permissions) element.append(permissionRow(permission));
    return { element };

    function permissionRow(permission) {
        const row = ui.element('div', { className: 'settings-permission' });
        const icon = ui.element('div', { className: 'settings-permission-icon' });
        const words = ui.element('div');
        const head = ui.element('div', { className: 'settings-permission-head' });

        icon.innerHTML = ui.icon(permission.icon, { size: 15 });
        head.append(
            ui.element('span', { className: 'settings-permission-name', text: permission.name }),
            ui.element('span', { className: 'settings-permission-id', text: permission.id })
        );
        words.append(
            head,
            ui.element('div', { className: 'settings-permission-reason', text: permission.reason }),
            ui.element('div', { className: 'settings-permission-means', text: permission.means })
        );
        row.append(icon, words);
        return row;
    }
}

module.exports = { PERMISSION_LIST_STYLE, permissionList };
