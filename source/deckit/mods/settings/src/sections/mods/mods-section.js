const { chip } = require('../../chip/chip.js');
const { NO_VALUE, contributionsOf, nameAndVersion, usageParts, listText } = require('../../format/format.js');
const { PERMISSION_LIST_STYLE, permissionList } = require('./permission-list.js');
const { MOD_DETAILS_STYLE, modDetails } = require('./mod-details.js');
const { restartNotice } = require('./restart-notice.js');
const { section } = require('../section/section.js');

// The Mods section: every mod found in their order, what each contributes, and installing and removing them.
// `onChange` hears that a mod was installed, removed, restarted or pinned here. Failures and what was done are told
// in a toast. `mods` is deckit.mods; `pins`, the panel's pins (shell.mods), or nothing under a shell that has none;
// `dropDestination` the shell's.
function modsSection({ ui, mods, pins, dropDestination, util, appName, onChange }) {
    const TITLE = 'Mods';
    const KEYWORDS = ['모드', '설치', '삭제', 'mods', 'install', 'remove'];
    // What a mod that loads but is not running is doing, by its run's state: one starting or stopping says it by a
    // spinner beside its name, with the word as its title.
    const STATE_WORDS = { launching: 'starting', terminating: 'stopping', notRunning: 'stopped' };
    const BUSY = ['launching', 'terminating'];
    // How long a restart asked here is shown at least: one that ends sooner would only flicker.
    const RESTART_SHOWN_MS = 600;
    const DESCRIPTION =
        'Install a mod from its folder, picked or dropped here, or remove one you no longer need. Open a row to see ' +
        'what it adds, what it needs and where its files are.';
    const COLUMNS = ['NAME', 'VERSION', 'CONTRIBUTES', ''];

    const rowFills = new WeakMap(); // row element -> its fill(mod)
    let listed = null; // what deckit last listed: the mods in their order, and what they do
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
        /* The cells stand at the top, on a first line as tall as a row action (22px): chips that wrap go below it.
           What is wrong with the mod goes under them, across the row. */
        .settings-mod-row {
            align-items: start;
            row-gap: 2px;
            min-height: 34px;
            padding-block: 6px;
            font: inherit;
            white-space: normal;
        }
        .settings-mod-name-cell { display: flex; align-items: center; gap: 4px; min-width: 0; height: 22px; }
        .settings-caret {
            display: flex;
            flex: 0 0 auto;
            margin-left: -4px;
            opacity: 0.45;
            transition: transform var(--deckit-slow) var(--deckit-easing);
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
            font: 11.5px/22px var(--deckit-font);
            font-variant-numeric: tabular-nums;
            opacity: 0.5;
        }
        .settings-mod-version[data-missing] { opacity: 0.25; }
        .settings-mod-contributions { display: flex; flex-wrap: wrap; gap: 5px; min-width: 0; padding-block: 2.5px; }
        .settings-mod-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 2px; }
        .settings-mod-actions > [hidden] { display: none; }
        .settings-mod-failure,
        .settings-mod-note {
            grid-column: 1 / -1;
            padding-left: 13px;
            font: var(--deckit-type-small);
            line-height: 1.5;
            white-space: pre-line;
            word-break: break-word;
        }
        .settings-mod-failure { color: var(--deckit-alert); }
        .settings-mod-note { opacity: 0.5; }
        .settings-install-mod { margin: 12px 0 6px; font: 600 var(--deckit-type-body); }
        .settings-install-mod:first-child { margin-top: 0; }
        /* Over the whole section while files are dragged over it, drawn inside it, so nothing of it is cut. The
           drag goes on to what is under it. */
        .settings-mods { position: relative; }
        .settings-drop {
            position: absolute;
            inset: 0;
            z-index: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: 2px solid var(--deckit-target);
            border-radius: var(--deckit-radius-medium);
            background: color-mix(in srgb, var(--deckit-background) 55%, transparent);
            backdrop-filter: blur(8px);
            color: var(--deckit-text);
            font: 600 var(--deckit-type-body);
            opacity: 0;
            pointer-events: none;
            transition: opacity var(--deckit-fast) var(--deckit-easing);
        }
        .settings-mods[data-targeted] .settings-drop { opacity: 1; }
        .settings-drop-icon { display: flex; color: var(--deckit-target); }
        .settings-install-note { margin-top: 10px; font: var(--deckit-type-small); line-height: 1.5; opacity: 0.5; }
    `);
    ui.addStyle(MOD_DETAILS_STYLE + PERMISSION_LIST_STYLE);
    const { element, head, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const drop = ui.element('div', { className: 'settings-drop' });
    const dropIcon = ui.element('div', { className: 'settings-drop-icon' });
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
    const restart = restartNotice({ ui, mods, appName });
    const headings = COLUMNS.map((text) => ui.element('div', { text }));

    // Over the name, past the caret in front of it.
    headings[0].style.paddingLeft = '13px';
    columns.append(...headings);
    head.append(installButton.element);
    element.classList.add('settings-mods');
    dropIcon.innerHTML = ui.icon('download', { size: 28 });
    drop.append(dropIcon, ui.element('div', { text: 'Drop to install mods' }));
    element.append(drop);
    dropDestination(element, {
        onTargeted: (on) => element.toggleAttribute('data-targeted', on),
        onDrop: dropAndInstall,
    });
    body.append(columns, rows.element, restart.element);
    return { element, title: TITLE, keywords: KEYWORDS, draw };

    function draw(state) {
        listed = state;
        restart.draw(state.found);
        render();
    }

    function render() {
        // Under a shell that has no Dock, no mod is kept in one.
        const pinned = new Set(pins ? pins.pinned() : []);
        rows.set(modRowsOf({ ...listed, pinned }));
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
            title: 'Restart this mod',
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
        // An interface it uses that reaches no one stops nothing, so it is said quietly, not as a fault.
        const note = ui.element('div', { className: 'settings-mod-note' });
        const details = modDetails({ ui, mods, pins, util, onPinnedChange: onChange });

        row.element.classList.add('settings-mod-columns', 'settings-mod-row');
        caret.innerHTML = ui.icon('chevronRight', { size: 13 });
        busy.append(ui.spinner({ size: 11 }).element);
        nameCell.append(caret, name, busy);
        actions.append(relaunchAction.element, revealAction.element, removeAction.element, source.element);
        row.element.append(nameCell, version, contributions, actions, failure, note);
        // Selectable: this is what gets pasted into a bug report.
        ui.selectable(failure);
        ui.selectable(note);
        element.append(row.element, details.element);
        // The clicks after the first of a double or triple click select words, not open or close the row.
        row.element.addEventListener('click', (event) => {
            if (event.detail > 1) return;
            open = !open;
            showOpen(true);
        });
        rowFills.set(element, fill);
        fill(mod);
        showOpen(false);
        return element;

        function fill(mod) {
            current = mod;
            const labels = mod.contributions;
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
                ...mod.refused,
            ]
                .filter(Boolean)
                .join('\n');
            failure.hidden = !failure.textContent;
            note.textContent = (mod.uses || [])
                .map((use) => use.problem)
                .filter(Boolean)
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
            picked = await mods.pick({ multiple: true });
        } catch (error) {
            return ui.toast('Could not install: ' + error.message);
        }
        askAndInstall(picked);
    }

    // Each folder refused on its own, so one refused leaves the others to install.
    async function dropAndInstall(folders) {
        const plans = folders.map((from) =>
            mods.planInstall(from).catch((error) => ({ from, problem: error.message }))
        );
        askAndInstall(await Promise.all(plans));
    }

    // The folders picked install one after another once the person agrees to what they replace and ask for. A folder
    // refused is told, and the others install.
    function askAndInstall(picked) {
        const refused = picked.filter((entry) => entry.problem);
        const plans = picked.filter((entry) => !entry.problem);
        if (!plans.length) {
            if (refused.length) ui.toast(refusalText(refused));
            return;
        }
        const asking = plans.filter((plan) => plan.permissions.length > 0);
        const replacing = plans.filter((plan) => plan.replaces);
        if (!asking.length && !replacing.length) return installPicked(plans, refused);
        const one = plans.length === 1;
        const verb = one && replacing.length ? 'Replace' : 'Install';
        const replaced = listText(replacing.map((plan) => plan.name));
        ui.dialog({
            title: one ? `${verb} ${plans[0].name}?` : `Install ${plans.length} mods?`,
            message: [
                replacing.length
                    ? `${one ? 'It' : 'Installing them'} replaces the installed ${replaced}. ` +
                      `What ${replacing.length === 1 ? 'it' : 'they'} stored is kept.`
                    : '',
                one && asking.length ? `${nameAndVersion(plans[0])} asks for:` : '',
            ],
            content: asking.length ? permissionRequest(asking, { named: !one }) : null,
            confirmLabel: verb,
            cancelLabel: 'Cancel',
            onConfirm: () => installPicked(plans, refused),
        });
    }

    async function installPicked(plans, refused) {
        const done = [];
        const failed = [];
        for (const plan of plans) {
            try {
                const installed = await mods.install(plan.from);
                done.push(`${plan.replaces ? 'Replaced' : 'Installed'} ${nameAndVersion(installed)}.`);
            } catch (error) {
                failed.push(`Could not install ${plan.name}: ${error.message}`);
            }
        }
        ui.toast([...done, ...failed, refused.length ? refusalText(refused) : ''].filter(Boolean).join(' '));
        if (done.length) onChange();
    }

    function refusalText(refused) {
        return refused.map(({ from, problem }) => `Could not install ${from.split('/').pop()}: ${problem}`).join(' ');
    }

    // `named`: each mod's list is headed by its name, as one dialog asks for several.
    function permissionRequest(plans, { named }) {
        const element = ui.element('div');
        for (const plan of plans) {
            if (named)
                element.append(
                    ui.element('div', { className: 'settings-install-mod', text: `${nameAndVersion(plan)} asks for:` })
                );
            element.append(permissionList({ ui, permissions: plan.permissions }).element);
        }
        element.append(
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
            return ui.toast('Could not tell what it stores: ' + error.message);
        }
        const hasData = places.length > 0;
        ui.dialog({
            title: `Remove ${mod.name}?`,
            message: [
                hasData
                    ? `This deletes the mod's code. Its ${listText(places)} will be kept unless you say otherwise: keeping ` +
                      'them means a reinstall picks up where you left off.'
                    : "This deletes the mod's code. It has nothing stored.",
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

    // The mod restarts, its row saying so until it is back.
    async function relaunch(mod) {
        const shown = new Promise((resolve) => setTimeout(resolve, RESTART_SHOWN_MS));
        restarting.add(mod.id);
        render();
        try {
            await Promise.all([mods.relaunch(mod.id), shown]);
        } catch (error) {
            return ui.toast('Could not restart: ' + error.message);
        } finally {
            restarting.delete(mod.id);
            render();
        }
        onChange();
    }

    async function remove(mod, { withData }) {
        try {
            await mods.remove(mod.id, withData);
        } catch (error) {
            return ui.toast('Could not remove: ' + error.message);
        }
        ui.toast(`Removed ${mod.name}${withData ? ' and its data' : ''}.`);
        onChange();
    }

    // One row per mod, in the mods' order whether it loads or not, each in its place whatever its run is doing: one
    // starting or stopping is in `running` as it last ran, and says so by its spinner. `notLoaded` is why one is not
    // running, `problem` what went wrong with one that is. What it declares and the permissions it asks for are read
    // from its manifest, so one that did not load still shows them. `shortcuts` are the keys as the Keyboard section
    // read them, `schemes` the schemes as the URL Schemes section did, and `refused` what the services of the
    // interfaces left out of what the mods declare, `[{ interface, mod, entry, problem }]`.
    function modRowsOf({ found, running, shortcuts, schemes, refused, pinned }) {
        return found.map((mod) => {
            const live = running.find((entry) => entry.id === mod.id) ?? null;
            const mainProcessFailure = mod.mainProcess?.failure || null;
            const row = {
                id: mod.id,
                name: live?.name ?? mod.name,
                version: mod.version,
                installed: mod.installed,
                shipped: mod.shipped,
                state: mod.run?.state,
                folder: mod.folder,
                permissions: mod.permissions,
                mainProcessFailure,
                uses: mod.uses,
                hides: mod.hides,
                view: mod.fields?.view ?? null,
                contributions: contributionsOf(mod, live),
                keys: shortcuts.filter((shortcut) => shortcut.mod?.id === mod.id),
                schemes: schemes.filter((scheme) => scheme.mods.some((entry) => entry.mod.id === mod.id)),
                refused: refused
                    .filter((one) => one.mod.id === mod.id)
                    .map((one) => `${one.interface}: ${one.problem}`),
                pinned: pinned.has(mod.id),
                restarting: restarting.has(mod.id),
            };
            if (live)
                return {
                    ...row,
                    problem: mainProcessFailure
                        ? 'a main process module did not start: ' + mainProcessFailure
                        : live.problem || null,
                };
            // One starting for the first time, or restarting here, is not yet anything but that: its spinner says so.
            const stopped =
                mod.run?.problem ||
                mod.run?.refusal?.message ||
                (mod.run?.state === 'launching' ? null : STATE_WORDS[mod.run?.state ?? 'notRunning']);
            return { ...row, notLoaded: mod.problem?.message || (restarting.has(mod.id) ? null : stopped) };
        });
    }
}

module.exports = { modsSection };
