const { chip } = require('../../chip/chip.js');
const { NO_VALUE, contributionsOf, nameAndVersion, usageParts, listText } = require('../../format/format.js');
const { PERMISSION_LIST_STYLE, permissionList } = require('./permission-list.js');
const { MOD_DETAILS_STYLE, modDetails } = require('./mod-details.js');
const { restartNotice } = require('./restart-notice.js');
const { section } = require('../section/section.js');

// The Mods section: every mod found in the load order, what each contributes, installing and removing them, and putting
// them in another order and applying it. `onChange` hears that a mod was installed, removed, restarted, pinned or moved
// here. Failures and what was done are told in the notice under the list. `mods` is deckit.mods; `pins`, the panel's
// pins (shell.mods), or nothing under a shell that has none.
function modsSection({ ui, mods, pins, everyScheme, util, appName, onChange }) {
    const TITLE = 'Mods';
    const KEYWORDS = ['모드', '설치', '삭제', 'mods', 'install', 'remove'];
    // What a mod that loads but is not running is doing, by its run's state: one starting or stopping says it by a
    // spinner beside its name, with the word as its title.
    const STATE_WORDS = { launching: 'starting', terminating: 'stopping', notRunning: 'stopped' };
    const BUSY = ['launching', 'terminating'];
    // How long a restart asked here is shown at least: one that ends sooner would only flicker.
    const RESTART_SHOWN_MS = 600;
    const DESCRIPTION =
        'Install a mod from its folder, or remove one you no longer need. Drag rows to change the order mods load ' +
        'in, then apply it. Open a row to see what it adds, what it needs and where its files are.';
    const COLUMNS = ['NAME', 'VERSION', 'CONTRIBUTES', ''];

    const rowFills = new WeakMap(); // row element -> its fill(mod)
    let ids = []; // the mods' ids, as the list was last drawn
    let listed = null; // what deck last listed: the mods in the order it keeps, and what they do
    let draft = null; // the order the rows were dragged into and not yet applied, or null
    let refusal = ''; // why deck refused the draft as it was applied, or ''
    let applying = false;
    const restarting = new Set(); // the ids of the mods a restart asked here is bringing back

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
        .settings-mod-row { min-height: 34px; padding-block: 6px; font: inherit; white-space: normal; }
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
        .settings-mod-busy { display: flex; flex: 0 0 auto; opacity: 0.6; }
        .settings-mod-busy[hidden] { display: none; }
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
        .settings-mod-failure,
        .settings-mod-note {
            margin-top: -6px;
            padding: 0 8px 8px 21px;
            font: var(--deckit-type-small);
            line-height: 1.5;
            white-space: pre-line;
            word-break: break-word;
        }
        .settings-mod-failure { color: var(--deckit-alert); }
        .settings-mod-note { opacity: 0.5; }
        .settings-notice {
            margin: 8px 0 0;
            padding: 8px 10px;
            border: var(--deckit-border);
            border-radius: 7px;
            font: 12.5px var(--deckit-font);
            line-height: 1.6;
            opacity: 0.8;
        }
        .settings-order {
            display: flex;
            align-items: center;
            gap: 6px;
            margin: 8px 0 0;
            font: 12.5px var(--deckit-font);
        }
        .settings-order[hidden] { display: none; }
        .settings-order-text { flex: 1 1 auto; opacity: 0.7; }
        .settings-order-text[data-refused] { color: var(--deckit-alert); opacity: 1; }
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
    // A drag changes the order drawn; it is deck's once applied. Deck refuses an order that puts a mod that loads
    // before one it requires, and the order stays drawn, with why, to be changed again.
    ui.sortable(rows, {
        onReorder: (id, toId) => {
            const next = [...ids];
            const from = next.indexOf(id);
            const to = next.indexOf(toId);
            if (applying || from < 0 || to < 0) return;
            next.splice(to, 0, next.splice(from, 1)[0]);
            draft = next.join() === listed.found.map((mod) => mod.id).join() ? null : next;
            refusal = '';
            render();
        },
    });
    const order = ui.element('div', { className: 'settings-order' });
    const orderText = ui.element('span', { className: 'settings-order-text' });
    const revertButton = ui.button({ label: 'Revert', size: 'small', onClick: settleOrder });
    const applyButton = ui.button({ label: 'Apply', size: 'small', variant: 'primary', onClick: applyOrder });
    const restart = restartNotice({ ui, mods, appName, onFailure: showNotice });
    const notice = ui.element('div', { className: 'settings-notice' });
    const headings = COLUMNS.map((text) => ui.element('div', { text }));

    // Over the name, past the caret in front of it.
    headings[0].style.paddingLeft = '13px';
    columns.append(...headings);
    notice.hidden = true;
    order.hidden = true;
    order.append(orderText, revertButton.element, applyButton.element);
    head.append(installButton.element);
    body.append(columns, rows.element, order, restart.element, notice);
    return { element, title: TITLE, keywords: KEYWORDS, draw, showNotice };

    function draw(state) {
        listed = state;
        restart.draw(state.found);
        render();
    }

    // The rows in the order dragged into while one is, those found since after them.
    function render() {
        // Under a shell that has no pins, no child is pinned.
        const pinned = new Set(pins ? pins.pinned() : []);
        const place = (mod) => (draft.includes(mod.id) ? draft.indexOf(mod.id) : draft.length);
        const found = draft ? [...listed.found].sort((mod, other) => place(mod) - place(other)) : listed.found;
        ids = found.map(({ id }) => id);
        order.hidden = !draft;
        orderText.textContent = refusal
            ? 'Could not apply the order: ' + refusal
            : 'The mods load in this order once it is applied.';
        orderText.toggleAttribute('data-refused', Boolean(refusal));
        rows.set(modRowsOf({ ...listed, found, pinned }));
    }

    // While it is applied, the order is neither dragged, applied again nor reverted.
    function applyOrder() {
        setApplying(true);
        mods.arrange(draft)
            .then(
                () => {
                    settleOrder();
                    onChange();
                },
                (error) => {
                    refusal = error.message;
                    render();
                }
            )
            .finally(() => setApplying(false));
    }

    function setApplying(on) {
        applying = on;
        applyButton.setEnabled(!on);
        revertButton.setEnabled(!on);
    }

    function settleOrder() {
        draft = null;
        refusal = '';
        render();
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
        const busy = ui.element('span', { className: 'settings-mod-busy' });
        const nameCell = ui.element('span', { className: 'settings-mod-name-cell' });
        const version = ui.element('span', { className: 'settings-mod-version' });
        const contributions = ui.element('div', { className: 'settings-mod-contributions' });
        const actions = ui.element('div', { className: 'settings-mod-actions' });
        const relaunchAction = ui.rowAction({
            icon: ui.icon('reload', { size: 14 }),
            title: 'Restart this mod, and the mods that require it',
            onClick: () => relaunch(current),
        });
        const revealAction = ui.rowAction({
            icon: ui.icon('externalWindow', { size: 14 }),
            title: 'Show in Finder',
            onClick: () => mods.reveal(current.id),
        });
        const removeAction = ui.rowAction({
            icon: ui.icon('x', { size: 14 }),
            title: 'Remove this mod',
            onClick: () => askRemove(current),
        });
        const source = chip({ ui, text: 'source', muted: true });
        const failure = ui.element('div', { className: 'settings-mod-failure' });
        // What is wrong with an optional dependency stops nothing, so it is said quietly, not as a fault.
        const note = ui.element('div', { className: 'settings-mod-note' });
        const details = modDetails({ ui, mods, pins, everyScheme, util, onPinnedChange: onChange });

        row.element.classList.add('settings-mod-columns', 'settings-mod-row');
        caret.innerHTML = ui.icon('chevronRight', { size: 13 });
        busy.append(ui.spinner({ size: 11 }).element);
        nameCell.append(caret, name, busy);
        actions.append(relaunchAction.element, revealAction.element, removeAction.element, source.element);
        row.element.append(nameCell, version, contributions, actions);
        // Selectable: this is what gets pasted into a bug report.
        ui.selectable(failure);
        ui.selectable(note);
        element.append(row.element, failure, note, details.element);
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
            const labels = contributionsOf(mod.live, mod.keys.length, everyScheme);
            name.textContent = name.title = mod.name;
            name.toggleAttribute('data-not-loaded', !!mod.notLoaded);
            busy.hidden = !mod.restarting && !BUSY.includes(mod.state);
            busy.title = mod.restarting ? 'restarting' : busy.hidden ? '' : STATE_WORDS[mod.state];
            version.textContent = mod.version || NO_VALUE;
            version.toggleAttribute('data-missing', !mod.version);
            contributions.replaceChildren(
                ...(labels.length ? labels : [NO_VALUE]).map(
                    (text) => chip({ ui, text, muted: !labels.length }).element
                )
            );
            relaunchAction.element.hidden = !mod.state || mod.restarting;
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
            note.textContent = (mod.relations || [])
                .filter((relation) => relation.optional && relation.problem)
                .map((relation) => relation.problem)
                .join('\n');
            note.hidden = !note.textContent;
            details.set(mod);
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
        let places;
        try {
            places = usageParts(await mods.usage(mod.id));
        } catch (error) {
            return showNotice('Could not tell what it stores: ' + error.message);
        }
        const hasData = places.length > 0;
        const names = new Map(mods.list().found.map((other) => [other.id, other.name]));
        const requiring = mod.dependents.map((id) => names.get(id) ?? id);
        const breaks = requiring.length
            ? `${requiring.join(', ')} ${requiring.length === 1 ? 'needs' : 'need'} it and will stop loading.`
            : '';
        ui.dialog({
            title: `Remove ${mod.name}?`,
            message: [
                hasData
                    ? `This deletes the mod's code. Its ${listText(places)} will be kept unless you say otherwise: keeping ` +
                      'them means a reinstall picks up where you left off.'
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

    // The mod and the mods that require it restart, their rows saying so until they are back.
    async function relaunch(mod) {
        const ids = [mod.id, ...mod.dependents];
        const shown = new Promise((resolve) => setTimeout(resolve, RESTART_SHOWN_MS));
        for (const id of ids) restarting.add(id);
        render();
        try {
            await Promise.all([mods.relaunch(mod.id), shown]);
        } catch (error) {
            return showNotice('Could not restart: ' + error.message);
        } finally {
            for (const id of ids) restarting.delete(id);
            render();
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

    // One row per mod, in the load order whether it loads or not, each in its place whatever its run is doing: one
    // starting or stopping is in `running` as it last ran, and says so by its spinner. `notLoaded` is why one is not
    // running, `problem` what went wrong with one that is. Permissions are read from the folder, so one that did not
    // load still shows the permissions it asks for.
    function modRowsOf({ found, running, shortcuts, handlerLists, pinned }) {
        const keysOf = (id) => shortcuts.filter((shortcut) => shortcut.provider === id);
        const fromDisk = (mod) => ({
            version: mod?.version,
            installed: mod?.installed,
            shipped: mod?.shipped,
            state: mod?.run?.state,
            folder: mod?.folder,
            permissions: mod?.permissions,
            mainProcessFailure: mod?.mainProcess.failure,
            relations: mod?.relations,
            dependents: mod?.dependents,
            hides: mod?.hides,
        });
        return found.map((mod) => {
            const live = running.find((entry) => entry.id === mod.id);
            if (!live)
                return {
                    id: mod.id,
                    name: mod.name,
                    ...fromDisk(mod),
                    keys: keysOf(mod.id),
                    handlerLists,
                    restarting: restarting.has(mod.id),
                    // One starting for the first time, or restarting here, is not yet anything but that: its spinner
                    // says so.
                    notLoaded:
                        mod.problem ||
                        (restarting.has(mod.id)
                            ? null
                            : mod.run?.problem ||
                              (mod.run?.state === 'launching' ? null : STATE_WORDS[mod.run?.state] || 'did not load')),
                };
            return {
                id: live.id,
                name: live.name,
                ...fromDisk(mod),
                live,
                pinned: pinned.has(live.id),
                keys: keysOf(live.id),
                handlerLists,
                restarting: restarting.has(live.id),
                problem: mod.mainProcess.failure
                    ? 'a main process module did not start: ' + mod.mainProcess.failure
                    : live.problem,
            };
        });
    }
}

module.exports = { modsSection };
