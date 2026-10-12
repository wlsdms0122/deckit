// A row of the sidebar's lists: an icon and a name. `set({ icon, label, title })` shows them, `icon` a kit icon's name.
function sidebarRow(ui) {
    let shownIcon = null;

    const row = ui.row();
    const icon = ui.element('span', { style: { display: 'flex', flex: '0 0 auto', opacity: '.8' } });
    const label = ui.element('span', {
        style: { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis' },
    });

    row.element.append(icon, label);

    return { ...row, set };

    function set({ icon: name, label: text, title }) {
        if (name !== shownIcon) {
            shownIcon = name;
            icon.innerHTML = ui.icon(name, { size: 16 });
        }
        label.textContent = text;
        row.element.title = title;
    }
}
