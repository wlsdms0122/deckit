// The permissions a plugin asks for: each one's name, id, the plugin's reason and what it lets the plugin do.
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
