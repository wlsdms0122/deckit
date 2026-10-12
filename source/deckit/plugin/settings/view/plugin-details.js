// What an opened plugin row shows: what it requires, its permissions, the addresses it opens, its keys and where it
// lives. It opens by its grid row (0fr to 1fr), which animates to the content's height without measuring it, over
// the base duration: over the fast one a tall row reads as a jump.
function pluginDetails({ ui, host, util, plugin, handlerLists }) {
    const everyScheme = host.urlSchemes.everyScheme;
    const asksMain = plugin.permissions?.some((permission) => permission.id === 'system.main-process');
    const runs = asksMain && !plugin.mainRunning ? 'main.js did not load' : '';

    let counted = false;

    const element = ui.element('div', { className: 'settings-details' });
    const clip = ui.element('div', { className: 'settings-details-clip' });
    const box = ui.element('div', { className: 'settings-details-box' });
    const place = ui.element('div', { className: 'settings-details-place' });
    const status = detailsLine(runs, { quiet: true });

    element.addEventListener('click', (event) => event.stopPropagation());
    if (plugin.requirements?.length)
        addPart(
            'Requires',
            chipRow(
                plugin.requirements.map((requirement) =>
                    statusChip(`${requirement.name} ${requirement.want}`, requirement.ok)
                )
            )
        );
    if (plugin.permissions?.length)
        addPart('Permissions', permissionList({ ui, permissions: plugin.permissions }).element);
    if (plugin.live?.urlSchemes.length) addPart('Opens', chipRow(openingChips()));
    if (plugin.keys.length) addPart('Keys', keyGrid());
    if (plugin.folder) place.append(detailsLine(util.tildify(plugin.folder)));
    place.append(status);
    addPart('Location', place);
    clip.append(box);
    element.append(clip);
    return { element, setOpen };

    function setOpen(open, animate) {
        if (open) count();
        if (!animate) element.style.transition = 'none';
        element.toggleAttribute('data-open', open);
        if (!animate) requestAnimationFrame(() => (element.style.transition = ''));
    }

    // Counted when the row is first opened: it walks the data folder, and most rows are never opened.
    function count() {
        if (counted) return;
        counted = true;
        host.plugins.count(plugin.id).then(
            (stored) => {
                const found =
                    stored.count || stored.hidden
                        ? `${storedFilesText(stored)} in data/${plugin.id}/`
                        : 'Nothing stored';
                status.textContent = status.title = [runs, found].filter(Boolean).join(' · ');
            },
            () => {}
        );
    }

    function addPart(title, body) {
        const part = ui.element('div', { className: 'settings-details-part' });
        part.append(ui.element('div', { className: 'settings-details-heading', text: title }), body);
        box.append(part);
    }

    function chipRow(chips) {
        const row = ui.element('div', { className: 'settings-details-chips' });
        row.append(...chips);
        return row;
    }

    function statusChip(text, ok) {
        const made = ui.element('span', { className: 'settings-status' });
        made.toggleAttribute('data-ok', !!ok);
        made.append(ui.element('span', { className: 'settings-status-dot' }), ui.element('span', { text }));
        return made;
    }

    // Where the plugin stands in each scheme's handler list. Its place is counted among the ones switched on: a plugin
    // switched off ahead of it is never asked.
    function openingChips() {
        return handlerLists
            .filter((handlerList) => handlerList.handlers.some((handler) => handler.id === plugin.id))
            .map((handlerList) => {
                const handler = handlerList.handlers.find((candidate) => candidate.id === plugin.id);
                const index = handlerList.handlers.filter((candidate) => candidate.on).indexOf(handler);
                const standing = handler.on ? 'asked ' + ordinal(index) : 'off';
                return statusChip(`${schemeName(handlerList.id, everyScheme)} · ${standing}`, handler.on);
            });
    }

    function keyGrid() {
        const grid = ui.element('div', { className: 'settings-details-keys' });
        for (const shortcut of plugin.keys) {
            const key = ui.element('div', { className: 'settings-details-key' });
            const label = ui.element('span', { className: 'settings-details-label', text: shortcut.label });
            label.title = shortcut.label;
            key.append(
                ui.element('span', {
                    className: 'settings-details-chord',
                    text: shortcut.spec ? shortcut.chord : 'None',
                }),
                label
            );
            grid.append(key);
        }
        return grid;
    }

    function detailsLine(text, { quiet = false } = {}) {
        const line = ui.element('div', { className: 'settings-details-line', text });
        line.title = text;
        line.toggleAttribute('data-quiet', quiet);
        return line;
    }
}
