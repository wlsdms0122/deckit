const { chip } = require('./chip.js');
const { NO_VALUE, contributionsOf, nameAndVersion, storedFilesText } = require('./format.js');
const { PERMISSION_LIST_STYLE, permissionList } = require('./permission-list.js');
const { MOD_DETAILS_STYLE, modDetails } = require('./mod-details.js');
const { restartNotice } = require('./restart-notice.js');
const { section } = require('./section.js');

// The Mods section: every mod found, what each contributes, and installing and removing them. `onChange` hears
// that a mod was installed or removed. Failures and what was done are told in the notice under the list.
function modsSection({ ui, mods, keymap, urlSchemes, util, appName, onChange }) {
    const TITLE = 'Mods';
    const KEYWORDS = ['모드', '설치', '삭제', 'mods', 'install', 'remove'];
    const STARTING = 'starting: its start() has not finished';
    // What a mod that loads but is not running is doing, by its run's state.
    const STATE_WORDS = { launching: STARTING, terminating: 'stopping', notRunning: 'stopped' };
    const DESCRIPTION =
        'Install a mod from its folder, or remove one you no longer need. Open a row to see what it adds, what it ' +
        'needs and where its files are.';
    const COLUMNS = ['NAME', 'VERSION', 'CONTRIBUTES', ''];

    let handlerLists = [];
    let draws = 0;
    const rowFills = new WeakMap(); // row element -> its fill(mod)

    ui.addStyle(`
        .settings-mod-columns {
            display: grid;
            grid-template-columns: minmax(96px, 180px) 56px minmax(0, 1fr) auto;
            align-items: center;
            gap: 10px;
        }
        .settings-mod-head {
            padding: 0 8px 5px;
            border-bottom: var(--deckit-border);
            font: 700 11px var(--deckit-font);
            letter-spacing: 0.05em;
            text-transform: uppercase;
            opacity: 0.35;
        }
        .settings-mod { cursor: pointer; }
        .settings-mod-row { min-height: 34px; font: inherit; white-space: normal; }
        .settings-mod-name-cell { display: flex; align-items: center; gap: 4px; min-width: 0; }
        .settings-caret {
            display: flex;
            flex: 0 0 auto;
            margin-left: -4px;
            opacity: 0.45;
            transition: transform var(--deckit-fast) var(--deckit-easing);
        }
        .settings-mod[data-open] .settings-caret { transform: rotate(90deg); }
        .settings-mod-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .settings-mod-name[data-not-loaded] { opacity: 0.45; }
        .settings-mod-version {
            flex: 0 0 auto;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font: 11.5px var(--deckit-font);
            font-variant-numeric: tabular-nums;
            opacity: 0.5;
        }
        .settings-mod-version[data-missing] { opacity: 0.25; }
        .settings-mod-contributions { display: flex; flex-wrap: wrap; gap: 5px; min-width: 0; }
        .settings-mod-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 2px; }
        .settings-mod-actions > [hidden] { display: none; }
        .settings-mod-failure {
            margin-top: -6px;
            padding: 0 8px 8px 21px;
            color: var(--deckit-alert);
            font: var(--deckit-type-small);
            line-height: 1.5;
            white-space: pre-line;
            word-break: break-word;
        }
        .settings-mod-failure[data-starting] { color: var(--deckit-muted); }
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
    ui.addStyle(MOD_DETAILS_STYLE + PERMISSION_LIST_STYLE);
    const { element, head, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const installButton = ui.button({
        label: 'Install Mod',
        size: 'small',
        icon: ui.icon('plus', { size: 14 }),
        onClick: pickAndInstall,
    });
    const columns = ui.element('div', { className: 'settings-mod-columns settings-mod-head' });
    const rows = ui.list({
        key: (mod) => mod.id,
        create: modRow,
        update: (row, mod) => rowFills.get(row)(mod),
    });
    const restart = restartNotice({ ui, mods, appName, onFailure: showNotice });
    const notice = ui.element('div', { className: 'settings-notice' });
    const headings = COLUMNS.map((text) => ui.element('div', { text }));

    // Over the name, past the caret in front of it.
    headings[0].style.paddingLeft = '13px';
    columns.append(...headings);
    notice.hidden = true;
    head.append(installButton.element);
    body.append(columns, rows.element, restart.element, notice);
    return { element, title: TITLE, keywords: KEYWORDS, draw, showNotice };

    // The latest draw is the one drawn: an earlier one still asking the panel's list gives way.
    async function draw({ onDisk, running }) {
        const turn = ++draws;
        const shortcuts = keymap.list();
        handlerLists = urlSchemes.list();
        restart.draw(onDisk);
        const listed = new Set(await mods.listed());
        if (turn === draws) rows.set(modRowsOf({ onDisk, running, shortcuts, listed }));
    }

    function showNotice(text) {
        notice.textContent = text;
        notice.hidden = false;
    }

    // A row opens and closes by a press, and stays as it is when the list is drawn again.
    function modRow(mod) {
        let current = mod;
        let open = false;

        const element = ui.element('div', { className: 'settings-mod' });
        const row = ui.row();
        const caret = ui.element('span', { className: 'settings-caret' });
        const name = ui.element('span', { className: 'settings-mod-name' });
        const nameCell = ui.element('span', { className: 'settings-mod-name-cell' });
        const version = ui.element('span', { className: 'settings-mod-version' });
        const contributions = ui.element('div', { className: 'settings-mod-contributions' });
        const actions = ui.element('div', { className: 'settings-mod-actions' });
        const relaunchAction = ui.rowAction({
            icon: ui.icon('reload', { size: 14 }),
            title: 'Restart this mod, and the mods that require it',
            onClick: () => relaunch(current),
        });
        const showInFinderAction = ui.rowAction({
            icon: ui.icon('externalWindow', { size: 14 }),
            title: 'Open the mod folder',
            onClick: () => mods.reveal(current.id),
        });
        const removeAction = ui.rowAction({
            icon: ui.icon('x', { size: 14 }),
            title: 'Remove this mod',
            onClick: () => askRemove(current),
        });
        const source = chip({ ui, text: 'source', muted: true });
        const failure = ui.element('div', { className: 'settings-mod-failure' });
        const details = modDetails({ ui, mods, urlSchemes, util, onListedChange: onChange });

        row.element.classList.add('settings-mod-columns', 'settings-mod-row');
        caret.innerHTML = ui.icon('chevronRight', { size: 13 });
        nameCell.append(caret, name);
        actions.append(relaunchAction.element, showInFinderAction.element, removeAction.element, source.element);
        row.element.append(nameCell, version, contributions, actions);
        // Selectable: this is what gets pasted into a bug report.
        ui.selectable(failure);
        element.append(row.element, failure, details.element);
        row.element.addEventListener('click', () => {
            open = !open;
            showOpen(true);
        });
        rowFills.set(element, fill);
        fill(mod);
        showOpen(false);
        return element;

        function fill(mod) {
            current = mod;
            const labels = contributionsOf(mod.live, mod.keys.length, urlSchemes.everyScheme);
            name.textContent = name.title = mod.name;
            name.toggleAttribute('data-not-loaded', !!mod.notLoaded);
            version.textContent = mod.version || NO_VALUE;
            version.toggleAttribute('data-missing', !mod.version);
            contributions.replaceChildren(
                ...(labels.length ? labels : [NO_VALUE]).map(
                    (text) => chip({ ui, text, muted: !labels.length }).element
                )
            );
            relaunchAction.element.hidden = !mod.state;
            removeAction.element.hidden = !mod.installed;
            source.element.hidden = !!(mod.installed || mod.shipped);
            source.element.title =
                `Read from ${mod.folder || 'a source folder'}, ` + 'not installed: it is removed there, not here.';
            failure.textContent = [
                mod.notLoaded || mod.problem,
                ...(mod.hides || []).map((folder) => `${folder} has the same id and is not read`),
            ]
                .filter(Boolean)
                .join('\n');
            failure.hidden = !failure.textContent;
            failure.toggleAttribute('data-starting', failure.textContent === STARTING);
            details.set(mod, handlerLists);
        }

        function showOpen(animate) {
            element.toggleAttribute('data-open', open);
            details.setOpen(open, animate);
            row.setActionsShown(open);
        }
    }

    async function pickAndInstall() {
        let picked;
        try {
            picked = await mods.pick();
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
            installed = await mods.install(picked.from);
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
                    'A mod reaches only what is listed here. Main Process is the exception: code there can do ' +
                    'whatever the app can, so install a mod that asks for it only if you trust where it came from.',
            })
        );
        return element;
    }

    async function askRemove(mod) {
        let stored;
        try {
            stored = await mods.count(mod.id);
        } catch (error) {
            return showNotice('Could not tell what it stores: ' + error.message);
        }
        const hasData = stored.count > 0 || stored.hidden;
        const requiring = mods
            .list()
            .installed.filter((other) => other.requires && other.requires[mod.id])
            .map((other) => other.name);
        const breaks = requiring.length
            ? `${requiring.join(', ')} ${requiring.length === 1 ? 'requires' : 'require'} it and will stop loading.`
            : '';
        ui.dialog({
            title: `Remove ${mod.name}?`,
            message: [
                hasData
                    ? `This deletes the mod's code. Its ${storedFilesText(stored)} in data/${mod.id}/ will be ` +
                      'kept unless you say otherwise: keeping them means a reinstall picks up where you left off.'
                    : "This deletes the mod's code. It has nothing stored.",
                breaks,
                'To bring it back, install its folder again with Install Mod.',
            ],
            confirmLabel: 'Remove',
            cancelLabel: 'Cancel',
            // Removing the data is never the primary answer, so Enter cannot reach it.
            extraLabel: hasData ? 'Remove with data' : null,
            onExtra: hasData ? () => remove(mod, { withData: true }) : null,
            destructive: true,
            onConfirm: () => remove(mod, { withData: false }),
        });
    }

    async function relaunch(mod) {
        try {
            await mods.relaunch(mod.id);
        } catch (error) {
            return showNotice('Could not restart: ' + error.message);
        }
        onChange();
    }

    async function remove(mod, { withData }) {
        try {
            await mods.remove(mod.id, withData);
        } catch (error) {
            return showNotice('Could not remove: ' + error.message);
        }
        showNotice(`Removed ${mod.name}${withData ? ' and its data' : ''}.`);
        onChange();
    }

    // One row per mod: the running ones first, in the order the panel loaded them so the list matches the nav, then
    // the ones found on disk that did not load or are still starting. `notLoaded` is why one is not running, `problem`
    // what went wrong with one that is. Permissions are read from the folder, so one that did not load still shows the
    // permissions it asks for.
    function modRowsOf({ onDisk, running, shortcuts, listed }) {
        const keysOf = (id) => shortcuts.filter((shortcut) => shortcut.owner === id);
        const fromDisk = (mod) => ({
            version: mod?.version,
            installed: mod?.installed,
            shipped: mod?.shipped,
            state: mod?.state,
            folder: mod?.folder,
            permissions: mod?.permissions,
            mainProcessFailure: mod?.mainProcess.failure,
            dependencies: mod?.dependencies,
            hides: mod?.hides,
        });
        const loaded = running.map((live) => {
            const found = onDisk.find((mod) => mod.id === live.id);
            return {
                id: live.id,
                name: live.name,
                ...fromDisk(found),
                live,
                listed: listed.has(live.id),
                keys: keysOf(live.id),
                problem: found?.mainProcess.failure
                    ? 'a main process module did not start: ' + found.mainProcess.failure
                    : live.problem,
            };
        });
        const loadedIds = new Set(running.map((live) => live.id));
        const notLoaded = onDisk
            .filter((mod) => !loadedIds.has(mod.id))
            .map((mod) => ({
                id: mod.id,
                name: mod.name,
                ...fromDisk(mod),
                keys: keysOf(mod.id),
                notLoaded: mod.problem || STATE_WORDS[mod.state] || 'did not load',
            }));
        return [...loaded, ...notLoaded];
    }
}

module.exports = { modsSection };
