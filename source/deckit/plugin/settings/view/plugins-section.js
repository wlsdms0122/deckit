// The Plugins section: every plugin found, what each contributes, and installing and removing them. `onChange` hears
// that a plugin was installed or removed. Failures and what was done are told in the notice under the list.
function pluginsSection({ ui, host, util, appName, onChange }) {
    const DESCRIPTION =
        'Install a plugin from its folder, or remove one you no longer need. Contributes is what each plugin adds: ' +
        'view is a page in the list on the left, and a plugin without one is opened from the quick switcher. ' +
        'Open a row to see what it needs, the keys it adds and where its files are.';
    const COLUMNS = ['NAME', 'VERSION', 'CONTRIBUTES', ''];

    // Survives a redraw: every visit redraws the list.
    const expanded = new Set();
    let handlerLists = [];

    const view = section({ ui, title: 'Plugins', description: DESCRIPTION });
    const installButton = ui.button({
        label: 'Install Plugin',
        size: 'small',
        icon: ui.icon('plus', { size: 14 }),
        onClick: pickAndInstall,
    });
    const head = ui.element('div', { className: 'settings-plugin-columns settings-plugin-head' });
    const rows = ui.list({ key: (plugin) => plugin.id, create: pluginRow });
    const restart = restartNotice({ ui, host, appName, onFailure: showNotice });
    const notice = ui.element('div', { className: 'settings-notice' });
    const headings = COLUMNS.map((text) => ui.element('div', { text }));

    // Over the name, past the caret in front of it.
    headings[0].style.paddingLeft = '13px';
    head.append(...headings);
    notice.hidden = true;
    view.head.append(installButton.element);
    view.body.append(head, rows.element, restart.element, notice);
    return { element: view.element, title: view.title, draw, showNotice };

    function draw({ onDisk, running }) {
        const shortcuts = host.keymap.list();
        handlerLists = host.urlSchemes.list();
        restart.draw(onDisk);
        rows.set(pluginRowsOf({ onDisk, running, shortcuts }));
    }

    function showNotice(text) {
        notice.textContent = text;
        notice.hidden = false;
    }

    function pluginRow(plugin) {
        const element = ui.element('div', { className: 'settings-plugin' });
        const row = ui.row();
        const caret = ui.element('span', { className: 'settings-caret' });
        const name = ui.element('span', { className: 'settings-plugin-name', text: plugin.name });
        const nameCell = ui.element('span', { className: 'settings-plugin-name-cell' });
        const version = ui.element('span', { className: 'settings-plugin-version', text: plugin.version || NO_VALUE });
        const contributions = ui.element('div', { className: 'settings-plugin-contributions' });
        const actions = ui.element('div', { className: 'settings-plugin-actions' });
        const details = pluginDetails({ ui, host, util, plugin, handlerLists });

        row.element.classList.add('settings-plugin-columns', 'settings-plugin-row');
        caret.innerHTML = ui.icon('chevronRight', { size: 13 });
        name.title = plugin.name;
        name.toggleAttribute('data-not-loaded', !!plugin.notLoaded);
        nameCell.append(caret, name);
        version.toggleAttribute('data-missing', !plugin.version);
        const labels = contributionsOf(plugin.live, plugin.keys.length, host.urlSchemes.everyScheme);
        if (labels.length) contributions.append(...labels.map((text) => chip({ ui, text })));
        else contributions.append(chip({ ui, text: NO_VALUE, muted: true }));
        actions.append(
            ui.rowAction({
                icon: ui.icon('externalWindow', { size: 14 }),
                title: 'Open the plugin folder',
                onClick: () => host.plugins.reveal(plugin.id),
            }).element
        );
        if (plugin.installed)
            actions.append(
                ui.rowAction({
                    icon: ui.icon('x', { size: 14 }),
                    title: 'Remove this plugin',
                    onClick: () => askRemove(plugin),
                }).element
            );
        else {
            const source = chip({ ui, text: 'source', muted: true });
            source.title =
                `Read from ${plugin.folder || 'a source folder'}, ` + 'not installed: it is removed there, not here.';
            actions.append(source);
        }
        row.element.append(nameCell, version, contributions, actions);
        element.append(row.element);
        if (plugin.notLoaded || plugin.problem) {
            const failure = ui.element('div', {
                className: 'settings-plugin-failure',
                text: plugin.notLoaded || plugin.problem,
            });
            // Selectable: this is what gets pasted into a bug report.
            ui.selectable(failure);
            element.append(failure);
        }
        element.append(details.element);
        row.element.addEventListener('click', () => {
            if (expanded.has(plugin.id)) expanded.delete(plugin.id);
            else expanded.add(plugin.id);
            paint(true);
        });
        paint(false);
        return element;

        function paint(animate) {
            const open = expanded.has(plugin.id);
            element.toggleAttribute('data-open', open);
            details.setOpen(open, animate);
            row.setRevealed(open);
        }
    }

    async function pickAndInstall() {
        let picked;
        try {
            picked = await host.plugins.pick();
        } catch (error) {
            return showNotice('Could not install: ' + error.message);
        }
        if (!picked) return;
        const asks = picked.permissions.length > 0;
        if (!asks && !picked.replaces) return installPicked(picked);
        const verb = picked.replaces ? 'Replace' : 'Install';
        ui.dialog({
            title: `${verb} ${picked.name}?`,
            message: [
                picked.replaces ? `It replaces the installed ${picked.name}. What it stored is kept.` : '',
                asks ? `${nameAndVersion(picked)} asks for:` : '',
            ],
            content: asks ? permissionRequest(picked.permissions) : null,
            confirmLabel: verb,
            cancelLabel: 'Cancel',
            onConfirm: () => installPicked(picked),
        });
    }

    async function installPicked(picked) {
        let installed;
        try {
            installed = await host.plugins.install(picked.from);
        } catch (error) {
            return showNotice('Could not install: ' + error.message);
        }
        showNotice(`${picked.replaces ? 'Replaced' : 'Installed'} ${nameAndVersion(installed)}.`);
        onChange();
    }

    function permissionRequest(permissions) {
        const element = ui.element('div');
        element.append(
            permissionList({ ui, permissions }).element,
            ui.element('div', {
                className: 'settings-install-note',
                text:
                    'A plugin reaches only what is listed here. Main Process is the exception: code there can do ' +
                    'whatever the app can, so install a plugin that asks for it only if you trust where it came from.',
            })
        );
        return element;
    }

    async function askRemove(plugin) {
        let stored;
        try {
            stored = await host.plugins.count(plugin.id);
        } catch (error) {
            return showNotice('Could not tell what it stores: ' + error.message);
        }
        const hasData = stored.count > 0 || stored.hidden;
        const requiring = host.plugins
            .list()
            .installed.filter((other) => other.requires && other.requires[plugin.id])
            .map((other) => other.name);
        const breaks = requiring.length
            ? `${requiring.join(', ')} ${requiring.length === 1 ? 'requires' : 'require'} it and will stop loading.`
            : '';
        ui.dialog({
            title: `Remove ${plugin.name}?`,
            message: [
                hasData
                    ? `This deletes the plugin's code. Its ${storedFilesText(stored)} in data/${plugin.id}/ will be ` +
                      'kept unless you say otherwise: keeping them means a reinstall picks up where you left off.'
                    : "This deletes the plugin's code. It has nothing stored.",
                breaks,
                'To bring it back, install its folder again with Install Plugin.',
            ],
            confirmLabel: 'Remove',
            cancelLabel: 'Cancel',
            // Removing the data is never the primary answer, so Enter cannot reach it.
            extraLabel: hasData ? 'Remove with data' : null,
            onExtra: hasData ? () => remove(plugin, { withData: true }) : null,
            destructive: true,
            onConfirm: () => remove(plugin, { withData: false }),
        });
    }

    async function remove(plugin, { withData }) {
        try {
            await host.plugins.remove(plugin.id, withData);
        } catch (error) {
            return showNotice('Could not remove: ' + error.message);
        }
        showNotice(`Removed ${plugin.name}${withData ? ' and its data' : ''}.`);
        onChange();
    }

    // One row per plugin: the running ones first, in the order the panel loaded them so the list matches the nav, then
    // the ones found on disk that did not load. `notLoaded` is why one is not running, `problem` what went wrong with
    // one that is. Permissions are read from the folder, so a plugin whose view failed still shows what its main half
    // was given.
    function pluginRowsOf({ onDisk, running, shortcuts }) {
        const keysOf = (id) => shortcuts.filter((shortcut) => shortcut.owner === id);
        const fromDisk = (plugin) => ({
            version: plugin?.version,
            installed: plugin?.installed,
            folder: plugin?.folder,
            permissions: plugin?.permissions,
            mainRunning: plugin?.main.running,
            requirements: plugin?.requirements,
        });
        const loaded = running.map((live) => {
            const found = onDisk.find((plugin) => plugin.id === live.id);
            return {
                id: live.id,
                name: live.name,
                ...fromDisk(found),
                live,
                keys: keysOf(live.id),
                problem: found?.main.failure ? 'main.js did not load: ' + found.main.failure : live.problem,
            };
        });
        const loadedIds = new Set(running.map((live) => live.id));
        const notLoaded = onDisk
            .filter((plugin) => !loadedIds.has(plugin.id))
            .map((plugin) => ({
                id: plugin.id,
                name: plugin.name,
                ...fromDisk(plugin),
                keys: keysOf(plugin.id),
                notLoaded: plugin.problem || 'did not load',
            }));
        return [...loaded, ...notLoaded];
    }
}
