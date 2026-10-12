// The Plugins section: every plugin found, what each contributes, and installing and removing them. `onChange` hears
// that a plugin was installed or removed. Failures and what was done are told in the notice under the list.
function pluginsSection({ ui, host, util, appName, onChange }) {
    const TITLE = 'Plugins';
    const KEYWORDS = ['플러그인', '설치', '삭제', 'plugins', 'install', 'remove'];
    const DESCRIPTION =
        'Install a plugin from its folder, or remove one you no longer need. Open a row to see what it adds, what it ' +
        'needs and where its files are.';
    const COLUMNS = ['NAME', 'VERSION', 'CONTRIBUTES', ''];

    let handlerLists = [];
    const rowFills = new WeakMap(); // row element -> its fill(plugin)

    ui.addStyle(`
        .settings-plugin-columns {
            display: grid;
            grid-template-columns: minmax(96px, 180px) 56px minmax(0, 1fr) auto;
            align-items: center;
            gap: 10px;
        }
        .settings-plugin-head {
            padding: 0 8px 5px;
            border-bottom: var(--deckit-border);
            font: 700 11px var(--deckit-font);
            letter-spacing: 0.05em;
            text-transform: uppercase;
            opacity: 0.35;
        }
        .settings-plugin { cursor: pointer; }
        .settings-plugin-row { min-height: 34px; font: inherit; white-space: normal; }
        .settings-plugin-name-cell { display: flex; align-items: center; gap: 4px; min-width: 0; }
        .settings-caret {
            display: flex;
            flex: 0 0 auto;
            margin-left: -4px;
            opacity: 0.45;
            transition: transform var(--deckit-fast) var(--deckit-easing);
        }
        .settings-plugin[data-open] .settings-caret { transform: rotate(90deg); }
        .settings-plugin-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .settings-plugin-name[data-not-loaded] { opacity: 0.45; }
        .settings-plugin-version {
            flex: 0 0 auto;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font: 11.5px var(--deckit-font);
            font-variant-numeric: tabular-nums;
            opacity: 0.5;
        }
        .settings-plugin-version[data-missing] { opacity: 0.25; }
        .settings-plugin-contributions { display: flex; flex-wrap: wrap; gap: 5px; min-width: 0; }
        .settings-plugin-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 2px; }
        .settings-plugin-actions > [hidden] { display: none; }
        .settings-plugin-failure {
            margin-top: -6px;
            padding: 0 8px 8px 21px;
            color: var(--deckit-alert);
            font: var(--deckit-type-small);
            line-height: 1.5;
            word-break: break-word;
        }
        .settings-notice {
            margin: 8px 0 0;
            padding: 8px 10px;
            border: var(--deckit-border);
            border-radius: 7px;
            font: 12.5px var(--deckit-font);
            line-height: 1.6;
            opacity: 0.8;
        }
        .settings-install-note { margin-top: 10px; font: var(--deckit-type-small); line-height: 1.5; opacity: 0.5; }
    `);
    ui.addStyle(PLUGIN_DETAILS_STYLE + PERMISSION_LIST_STYLE);
    const { element, head, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const installButton = ui.button({
        label: 'Install Plugin',
        size: 'small',
        icon: ui.icon('plus', { size: 14 }),
        onClick: pickAndInstall,
    });
    const columns = ui.element('div', { className: 'settings-plugin-columns settings-plugin-head' });
    const rows = ui.list({
        key: (plugin) => plugin.id,
        create: pluginRow,
        update: (row, plugin) => rowFills.get(row)(plugin),
    });
    const restart = restartNotice({ ui, host, appName, onFailure: showNotice });
    const notice = ui.element('div', { className: 'settings-notice' });
    const headings = COLUMNS.map((text) => ui.element('div', { text }));

    // Over the name, past the caret in front of it.
    headings[0].style.paddingLeft = '13px';
    columns.append(...headings);
    notice.hidden = true;
    head.append(installButton.element);
    body.append(columns, rows.element, restart.element, notice);
    return { element, title: TITLE, keywords: KEYWORDS, draw, showNotice };

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

    // A row opens and closes by a press, and stays as it is when the list is drawn again.
    function pluginRow(plugin) {
        let current = plugin;
        let open = false;

        const element = ui.element('div', { className: 'settings-plugin' });
        const row = ui.row();
        const caret = ui.element('span', { className: 'settings-caret' });
        const name = ui.element('span', { className: 'settings-plugin-name' });
        const nameCell = ui.element('span', { className: 'settings-plugin-name-cell' });
        const version = ui.element('span', { className: 'settings-plugin-version' });
        const contributions = ui.element('div', { className: 'settings-plugin-contributions' });
        const actions = ui.element('div', { className: 'settings-plugin-actions' });
        const revealAction = ui.rowAction({
            icon: ui.icon('externalWindow', { size: 14 }),
            title: 'Open the plugin folder',
            onClick: () => host.plugins.reveal(current.id),
        });
        const removeAction = ui.rowAction({
            icon: ui.icon('x', { size: 14 }),
            title: 'Remove this plugin',
            onClick: () => askRemove(current),
        });
        const source = chip({ ui, text: 'source', muted: true });
        const failure = ui.element('div', { className: 'settings-plugin-failure' });
        const details = pluginDetails({ ui, host, util });

        row.element.classList.add('settings-plugin-columns', 'settings-plugin-row');
        caret.innerHTML = ui.icon('chevronRight', { size: 13 });
        nameCell.append(caret, name);
        actions.append(revealAction.element, removeAction.element, source.element);
        row.element.append(nameCell, version, contributions, actions);
        // Selectable: this is what gets pasted into a bug report.
        ui.selectable(failure);
        element.append(row.element, failure, details.element);
        row.element.addEventListener('click', () => {
            open = !open;
            showOpen(true);
        });
        rowFills.set(element, fill);
        fill(plugin);
        showOpen(false);
        return element;

        function fill(plugin) {
            current = plugin;
            const labels = contributionsOf(plugin.live, plugin.keys.length, host.urlSchemes.everyScheme);
            name.textContent = name.title = plugin.name;
            name.toggleAttribute('data-not-loaded', !!plugin.notLoaded);
            version.textContent = plugin.version || NO_VALUE;
            version.toggleAttribute('data-missing', !plugin.version);
            contributions.replaceChildren(
                ...(labels.length ? labels : [NO_VALUE]).map(
                    (text) => chip({ ui, text, muted: !labels.length }).element
                )
            );
            removeAction.element.hidden = !plugin.installed;
            source.element.hidden = !!plugin.installed;
            source.element.title =
                `Read from ${plugin.folder || 'a source folder'}, ` + 'not installed: it is removed there, not here.';
            failure.textContent = plugin.notLoaded || plugin.problem || '';
            failure.hidden = !failure.textContent;
            details.set(plugin, handlerLists);
        }

        function showOpen(animate) {
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
