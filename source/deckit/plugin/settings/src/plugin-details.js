const { statusChip } = require('./chip.js');
const { ordinal, schemeName, storedFilesText } = require('./format.js');
const { permissionList } = require('./permission-list.js');

// The rules of an opened row. The Plugins section adopts them once.
const PLUGIN_DETAILS_STYLE = `
    .settings-details {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        cursor: default;
        transition:
            grid-template-rows var(--deckit-base) var(--deckit-easing),
            opacity var(--deckit-base) var(--deckit-easing);
    }
    .settings-details[data-open] { grid-template-rows: 1fr; opacity: 1; }
    .settings-details-clip { min-height: 0; overflow: hidden; }
    .settings-details-box {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 2px 8px 8px 21px;
        padding: 10px 12px;
        border-radius: var(--deckit-radius-medium);
        background: var(--deckit-fill);
        font: 12.5px var(--deckit-font);
    }
    .settings-details-part { display: flex; flex-direction: column; gap: 5px; }
    .settings-details-heading {
        font: 700 10.5px var(--deckit-font);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.4;
    }
    .settings-details-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .settings-details-keys {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: 4px 14px;
    }
    .settings-details-key { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .settings-details-chord {
        flex: 0 0 auto;
        min-width: 26px;
        padding: 0 5px;
        border: var(--deckit-border);
        border-radius: var(--deckit-radius-small);
        font: 11.5px var(--deckit-font);
        line-height: 18px;
        text-align: center;
        opacity: 0.8;
    }
    .settings-details-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.85;
    }
    .settings-details-location { display: flex; flex-direction: column; gap: 2px; }
    .settings-details-line { overflow-wrap: anywhere; font: 12.5px var(--deckit-font); opacity: 0.85; }
    .settings-details-line[data-muted] { font: var(--deckit-type-small); opacity: 0.45; }
`;

// What an opened plugin row shows: what it requires, its permissions, the addresses it opens, its keys and where it
// lives. It opens by its grid row (0fr to 1fr), which animates to the content's height without measuring it, over
// the base duration: over the fast one a tall row reads as a jump.
function pluginDetails({ ui, plugins, urlSchemes, util }) {
    const everyScheme = urlSchemes.everyScheme;

    let plugin = null;
    let open = false;
    let counted = false;
    let mainFailure = '';
    let statusLine = null;

    const element = ui.element('div', { className: 'settings-details' });
    const clip = ui.element('div', { className: 'settings-details-clip' });
    const box = ui.element('div', { className: 'settings-details-box' });

    element.addEventListener('click', (event) => event.stopPropagation());
    clip.append(box);
    element.append(clip);
    return { element, set, setOpen };

    // A plugin set again is counted again when it is open.
    function set(next, handlerLists) {
        plugin = next;
        counted = false;
        // A main process module starts when the plugin asks for it, so none running is no fault: only a start that
        // failed is told.
        mainFailure = plugin.mainProcessFailure ? 'A main process module did not start' : '';
        statusLine = detailsLine(mainFailure, { muted: true });
        box.replaceChildren();
        if (plugin.requirements?.length)
            addPart(
                'Requires',
                chipRow(
                    plugin.requirements.map(
                        (requirement) =>
                            statusChip({ ui, text: `${requirement.name} ${requirement.want}`, ok: requirement.ok })
                                .element
                    )
                )
            );
        if (plugin.permissions?.length)
            addPart('Permissions', permissionList({ ui, permissions: plugin.permissions }).element);
        if (plugin.live?.urlSchemes.length) addPart('Opens', chipRow(openingChips(handlerLists)));
        if (plugin.keys.length) addPart('Keys', keyGrid());
        const location = ui.element('div', { className: 'settings-details-location' });
        if (plugin.folder) location.append(detailsLine(util.tildify(plugin.folder)));
        location.append(statusLine);
        addPart('Location', location);
        if (open) count();
    }

    function setOpen(on, animate) {
        open = on;
        if (open) count();
        if (!animate) element.style.transition = 'none';
        element.toggleAttribute('data-open', open);
        if (!animate) requestAnimationFrame(() => (element.style.transition = ''));
    }

    // Counted when the row is open: it walks the data folder, and most rows are never opened.
    function count() {
        if (counted) return;
        counted = true;
        const { id } = plugin;
        const line = statusLine;
        const failure = mainFailure;
        plugins.count(id).then(
            (stored) => {
                const found =
                    stored.count || stored.hidden ? `${storedFilesText(stored)} in data/${id}/` : 'Nothing stored';
                line.textContent = line.title = [failure, found].filter(Boolean).join(' · ');
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

    // Where the plugin stands in each scheme's handler list. Its position is counted among the ones switched on: a
    // plugin switched off ahead of it is never asked.
    function openingChips(handlerLists) {
        return handlerLists
            .filter((handlerList) => handlerList.handlers.some((handler) => handler.id === plugin.id))
            .map((handlerList) => {
                const handler = handlerList.handlers.find((candidate) => candidate.id === plugin.id);
                const index = handlerList.handlers.filter((candidate) => candidate.on).indexOf(handler);
                const standing = handler.on ? 'asked ' + ordinal(index) : 'off';
                return statusChip({
                    ui,
                    text: `${schemeName(handlerList.scheme, everyScheme)} · ${standing}`,
                    ok: handler.on,
                }).element;
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

    function detailsLine(text, { muted = false } = {}) {
        const line = ui.element('div', { className: 'settings-details-line', text });
        line.title = text;
        line.toggleAttribute('data-muted', muted);
        return line;
    }
}

module.exports = { PLUGIN_DETAILS_STYLE, pluginDetails };
