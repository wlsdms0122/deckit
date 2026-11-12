const { chip } = require('../../chip/chip.js');
const {
    NO_VALUE,
    contributionsOf,
    nameAndVersion,
    shortPath,
    usageParts,
    listText,
} = require('../../format/format.js');
const { PERMISSION_LIST_STYLE, permissionList } = require('./permission-list.js');
const { DEPENDENCY_LIST_STYLE, dependencyList } = require('./dependency-list.js');
const { MOD_DETAILS_STYLE, modDetails } = require('./mod-details.js');
const { restartNotice } = require('./restart-notice.js');
const { section } = require('../section/section.js');

// The Mods section: every mod found in their order, what each contributes, and installing and removing them. `onChange`
// hears that a mod was installed, removed, restarted or pinned here. A mod installed is shown by its row, lit; what
// failed on a row is said on it; a refusal of what was picked, and a mod removed, are told in a toast. `mods` is
// deckit.mods; `mainProcess` what the mods' main process modules come to, or nothing under a host that runs none;
// `packages()`, deckit/packages while it is connected, which installs, dry run too; `pins`, the Dock's pins
// (shell.mods), or nothing under a shell that has none; `dropDestination`, `dialogs` and `reveal` the shell's;
// `tildify(path)` a path as it is shown; `icons` the mods' app icons, each drawn before its name.
function modsSection({
    ui,
    icons,
    mods,
    mainProcess,
    packages,
    pins,
    dropDestination,
    dialogs,
    reveal,
    tildify,
    appName,
    onChange,
}) {
    const TITLE = 'Mods';
    const PACKAGES = 'deckit/packages';
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
    const COLUMNS = ['Name', 'Version', 'Contributes', ''];
    // How long a row just installed stays lit.
    const HIGHLIGHT_LENGTH = 1200;

    const rowFills = new WeakMap(); // row element -> its fill(mod)
    const rowsById = new Map(); // mod id -> its row element
    const failures = new Map(); // mod id -> why what was asked on its row did not happen, until the next ask
    const lighting = new Set(); // the ids of the mods just installed, to light once their rows are drawn
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
            color: var(--deckit-muted);
            font: var(--deckit-type-label);
        }
        .settings-mod { cursor: pointer; }
        /* The cells stand at the top, on a first line as tall as a row action (24px): words that wrap go below it.
           What is wrong with the mod goes under them, across the row. */
        .settings-mod-row {
            align-items: start;
            row-gap: 2px;
            min-height: 36px;
            padding-block: 6px;
            font: inherit;
            white-space: normal;
            transition: background-color var(--deckit-fade) var(--deckit-easing);
        }
        .settings-mod[data-highlighted] .settings-mod-row {
            background: color-mix(in srgb, var(--deckit-accent) 12%, transparent);
        }
        .settings-mod-name-cell { display: flex; align-items: center; gap: 4px; min-width: 0; height: 24px; }
        .settings-caret {
            display: flex;
            flex: 0 0 auto;
            margin-left: -4px;
            color: var(--deckit-muted);
            transition: transform var(--deckit-move-slow) var(--deckit-easing);
        }
        .settings-mod[data-open] .settings-caret { transform: rotate(90deg); }
        .settings-mod-name-cell .deckit-app-icon { margin-right: 4px; }
        .settings-mod-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .settings-mod-name[data-not-loaded] { color: var(--deckit-muted); }
        .settings-mod-busy { display: flex; flex: 0 0 auto; color: var(--deckit-muted); }
        .settings-mod-busy[hidden] { display: none; }
        .settings-mod-version {
            flex: 0 0 auto;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: var(--deckit-muted);
            font: var(--deckit-type-small);
            line-height: 24px;
            font-variant-numeric: tabular-nums;
        }
        .settings-mod-version[data-missing] { color: var(--deckit-disabled); }
        .settings-mod-contributions {
            min-width: 0;
            padding-block: 4px;
            color: var(--deckit-muted);
            font: var(--deckit-type-small);
            overflow-wrap: anywhere;
        }
        .settings-mod-contributions[data-missing] { color: var(--deckit-disabled); }
        .settings-mod-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 2px; }
        .settings-mod-actions > [hidden] { display: none; }
        .settings-mod-failure,
        .settings-mod-note {
            grid-column: 1 / -1;
            padding-left: 13px;
            font: var(--deckit-type-small);
            white-space: pre-line;
            word-break: break-word;
        }
        .settings-mod-failure { color: var(--deckit-alert-ink); }
        .settings-mod-note { color: var(--deckit-muted); }
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
            transition: opacity var(--deckit-fade) var(--deckit-easing);
        }
        .settings-mods[data-targeted] .settings-drop { opacity: 1; }
        .settings-drop-icon { display: flex; color: var(--deckit-target); }
        .settings-install-note { margin-top: 10px; color: var(--deckit-muted); font: var(--deckit-type-small); }
    `);
    ui.addStyle(MOD_DETAILS_STYLE + PERMISSION_LIST_STYLE + DEPENDENCY_LIST_STYLE);
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
    const restart = restartNotice({ ui, mods, mainProcess, appName });
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
        restart.draw(state.list);
        render();
    }

    // Under a shell that has no Dock, or one that does not answer, no mod is kept in one.
    async function render() {
        const kept = pins ? await pins.pinned().catch(() => []) : [];
        rows.set(modRowsOf({ ...listed, pinned: new Set(kept) }));
        for (const id of lighting) {
            const row = rowsById.get(id);
            if (!row?.isConnected) continue;
            lighting.delete(id);
            row.scrollIntoView({ block: 'nearest' });
            row.toggleAttribute('data-highlighted', true);
            setTimeout(() => row.toggleAttribute('data-highlighted', false), HIGHLIGHT_LENGTH);
        }
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
            title: 'Show in Folder',
            onClick: () => reveal(current.folder),
        });
        const removeAction = ui.rowAction({
            icon: ui.icon('x', { size: 14 }),
            title: 'Remove this mod',
            onClick: () => askRemove(current),
        });
        const source = chip({ ui, text: 'source', muted: true });
        const failure = ui.element('div', { className: 'settings-mod-failure' });
        // A mod that is only not running, and an interface it uses that reaches no one, stop nothing, so they are said
        // quietly, not as a fault.
        const note = ui.element('div', { className: 'settings-mod-note' });
        const details = modDetails({ ui, mods, pins, tildify, onPinnedChange: onChange });

        row.element.classList.add('settings-mod-columns', 'settings-mod-row');
        caret.innerHTML = ui.icon('chevronRight', { size: 13 });
        busy.append(ui.spinner({ size: 11 }).element);
        let icon = ui.appIcon('', { size: 'row' });
        nameCell.append(caret, icon, name, busy);
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
        rowsById.set(mod.id, element);
        fill(mod);
        showOpen(false);
        return element;

        function fill(mod) {
            current = mod;
            const labels = mod.contributions;
            name.textContent = name.title = mod.name;
            const drawn = icons.of(mod.id);
            if (icon.dataset.drawn !== drawn) {
                const next = ui.appIcon(drawn, { size: 'row' });
                next.dataset.drawn = drawn;
                icon.replaceWith(next);
                icon = next;
            }
            name.toggleAttribute('data-not-loaded', !!mod.notLoaded);
            busy.hidden = !mod.restarting && !BUSY.includes(mod.state);
            busy.title = mod.restarting ? 'restarting' : busy.hidden ? '' : STATE_WORDS[mod.state];
            version.textContent = mod.version || NO_VALUE;
            version.toggleAttribute('data-missing', !mod.version);
            contributions.textContent = labels.length ? sentence(labels.join(', ')) : NO_VALUE;
            contributions.toggleAttribute('data-missing', !labels.length);
            relaunchAction.element.hidden = !mod.state || mod.restarting;
            removeAction.element.hidden = !mod.installed;
            source.element.hidden = !!(mod.installed || mod.shipped);
            source.element.title =
                `Read from ${mod.folder || 'a source folder'}, ` + 'not installed: it is removed there, not here.';
            failure.textContent = [
                failures.get(mod.id),
                (mod.failed && mod.notLoaded) || mod.problem,
                ...(mod.hides || []).map((folder) => `${folder} has the same id and is not read`),
                ...mod.refused,
            ]
                .filter(Boolean)
                .join('\n');
            failure.hidden = !failure.textContent;
            note.textContent = [
                !mod.failed && mod.notLoaded && sentence(mod.notLoaded),
                ...(mod.uses || []).map((use) => use.problem),
            ]
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
        let folders;
        try {
            folders = await dialogs.chooseFolders({
                multiple: true,
                title: 'Choose mod folders',
                message: 'Pick the folders that have manifest.toml in them',
            });
        } catch (error) {
            return ui.toast('Could not choose folders: ' + error.message, { kind: 'failure' });
        }
        askAndInstall(await Promise.all(folders.map(planOf)));
    }

    // Each folder refused on its own, so one refused leaves the others to install.
    async function dropAndInstall(folders) {
        askAndInstall(await Promise.all(folders.map(planOf)));
    }

    // What the folder would install, with what it depends on, beside the folder, or `{ folder, problem }` for one
    // refused.
    function planOf(folder) {
        return Promise.resolve()
            .then(() => service().install(folder, { dryRun: true }))
            .then((plan) => ({ ...plan, folder }))
            .catch((error) => ({ folder, problem: error.message }));
    }

    // The folders picked install one after another once the person agrees to what they replace, ask for and depend
    // on. One whose dependency is unmet is told so and left out. A folder refused is told, and the others install.
    function askAndInstall(picked) {
        const refused = picked.filter((entry) => entry.problem);
        const plans = picked.filter((entry) => !entry.problem);
        if (!plans.length) {
            if (refused.length) refuse(refused);
            return;
        }
        const unmet = plans.filter((plan) => plan.dependencies.some((dependency) => !dependency.satisfied));
        const installing = plans.filter((plan) => !unmet.includes(plan));
        const asking = plans.filter(
            (plan) => plan.permissions.length > 0 || plan.background || plan.dependencies.length
        );
        const replacing = installing.filter((plan) => plan.replaces);
        if (!asking.length && !replacing.length) return installPicked(plans, refused);
        const one = plans.length === 1;
        const verb = installing.length === 1 && replacing.length ? 'Replace' : 'Install';
        const replaced = listText(replacing.map((plan) => plan.name));
        const unmetNames = listText(unmet.map((plan) => plan.name));
        ui.dialog({
            title: !installing.length
                ? `Cannot install ${one ? plans[0].name : `${plans.length} mods`}`
                : installing.length === 1
                  ? `${verb} ${installing[0].name}?`
                  : `Install ${installing.length} mods?`,
            message: [
                replacing.length
                    ? `${one ? 'It' : 'Installing them'} replaces the installed ${replaced}. ` +
                      `What ${replacing.length === 1 ? 'it' : 'they'} stored is kept.`
                    : '',
                unmet.length
                    ? `${one ? 'It' : unmetNames} cannot be installed until the mods ` +
                      `${unmet.length === 1 ? 'it depends' : 'they depend'} on are installed at versions ` +
                      `${unmet.length === 1 ? 'it takes' : 'they take'}. Install them first.`
                    : '',
            ],
            content: request(asking),
            confirmLabel: installing.length ? verb : null,
            cancelLabel: installing.length ? 'Cancel' : 'OK',
            onConfirm: () => installPicked(installing, refused),
        });
    }

    // What installs is lit in the list; what did not is told, with a retry.
    async function installPicked(plans, refused) {
        const failed = [];
        for (const plan of plans) {
            try {
                const installed = await service().install(plan.folder);
                lighting.add(installed.id);
            } catch (error) {
                failed.push({ plan, problem: error.message });
            }
        }
        if (refused.length) refuse(refused);
        if (failed.length)
            ui.toast(
                failed.map(({ plan, problem }) => `Could not install ${plan.name}: ${pathsCut(problem)}`).join(' '),
                {
                    kind: 'failure',
                    action: {
                        label: 'Try Again',
                        run: () =>
                            installPicked(
                                failed.map(({ plan }) => plan),
                                []
                            ),
                    },
                }
            );
        if (lighting.size) onChange();
    }

    function service() {
        const connected = packages();
        if (!connected) throw new Error(`${PACKAGES} is not connected`);
        return connected;
    }

    // Folders picked that hold no mod, or one refused as it is: said in their words, with a way to pick again.
    function refuse(refused) {
        const text = refused
            .map(({ folder, problem }) => {
                const name = folder.split('/').pop();
                return /^no manifest\.toml in /.test(problem)
                    ? `${name} is not a mod folder: it has no manifest.toml.`
                    : `Could not install ${name}: ${pathsCut(problem)}`;
            })
            .join(' ');
        ui.toast(text, { kind: 'failure', action: { label: 'Choose Another Folder…', run: pickAndInstall } });
    }

    // `text` with each path in it cut in the middle.
    function pathsCut(text) {
        return text.replace(/\/[^\s:,]+/g, (path) => shortPath(path));
    }

    // What each mod planned depends on and asks for, each list headed by its name.
    function request(plans) {
        const element = ui.element('div');
        const heading = (text) => ui.element('div', { className: 'settings-install-mod', text });
        for (const plan of plans) {
            const { dependencies, permissions, background } = plan;
            if (dependencies.length)
                element.append(
                    heading(`${nameAndVersion(plan)} depends on:`),
                    dependencyList({ ui, dependencies, nameOf }).element
                );
            if (permissions.length || background)
                element.append(
                    heading(`${nameAndVersion(plan)} asks for:`),
                    permissionList({ ui, permissions, background }).element
                );
        }
        if (plans.some((plan) => plan.permissions.length || plan.background))
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

    // The name of the mod of the id `id` as deckit last listed it, or the id for one not found.
    function nameOf(id) {
        return listed?.list.find((entry) => entry.id === id)?.mod?.name || id;
    }

    async function askRemove(mod) {
        let places;
        failed(mod, '');
        try {
            places = usageParts(await mods.usage(mod.id));
        } catch (error) {
            return failed(mod, 'Could not tell what it stores: ' + error.message);
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
        failures.delete(mod.id);
        restarting.add(mod.id);
        render();
        try {
            await Promise.all([mods.relaunch(mod.id), shown]);
        } catch (error) {
            return failures.set(mod.id, 'Could not restart: ' + error.message);
        } finally {
            restarting.delete(mod.id);
            render();
        }
        onChange();
    }

    async function remove(mod, { withData }) {
        let erased;
        try {
            ({ erased } = await mods.remove(mod.id, withData));
        } catch (error) {
            return failed(mod, 'Could not remove: ' + error.message);
        }
        ui.toast(`Removed ${mod.name}${erased ? ' and its data' : ''}.`);
        onChange();
    }

    // `text` on the row of `mod`, in place of what failed there before; empty clears it.
    function failed(mod, text) {
        if (text) failures.set(mod.id, text);
        else failures.delete(mod.id);
        render();
    }

    // The first letter of `text` in capitals.
    function sentence(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    // One row per mod of `list`, in the mods' order whether it loads or not, each in its place whatever its run, as
    // `runs` answers it, is doing: one starting or stopping shows what its run that launched contributed, and says so
    // by its spinner. `notLoaded` is why one is not running, `failed` whether that is a failure rather than its state,
    // `problem` what went wrong with one that is. What it declares and the permissions it asks for are read from its
    // manifest. Each interface it uses is read from `interfaces`. `shortcuts` are the keys as the Keyboard section read
    // them, `schemes` the schemes as the URL Schemes section did, `refused` what the services of the interfaces left
    // out of what the mods declare, `[{ interface, mod, entry, problem }]`, and `failures` why the main process modules
    // of a mod that did not start did not, by its id.
    function modRowsOf({ list, runs, interfaces, shortcuts, schemes, refused, failures, pinned }) {
        return list.map((entry) => {
            const manifest = entry.mod ?? {};
            const run = runs.find((each) => each.id === entry.id) ?? null;
            const live = run && (run.state === 'running' || run.summary) ? run : null;
            const mainProcessFailure = failures.get(entry.id) ?? null;
            const row = {
                id: entry.id,
                name: manifest.name ?? entry.id,
                version: manifest.version,
                installed: entry.installed,
                shipped: entry.shipped,
                state: run?.state,
                folder: entry.folder,
                permissions: manifest.permissions,
                mainProcessFailure,
                uses: usesOf(entry.id, interfaces),
                hides: entry.hides,
                view: manifest.fields?.view ?? null,
                contributions: contributionsOf(manifest, live?.summary),
                keys: shortcuts.filter((shortcut) => shortcut.mod?.id === entry.id),
                schemes: schemes.filter((scheme) => scheme.mods.some((one) => one.mod.id === entry.id)),
                refused: refused
                    .filter((one) => one.mod.id === entry.id)
                    .map((one) => `${one.interface}: ${one.problem}`),
                pinned: pinned.has(entry.id),
                restarting: restarting.has(entry.id),
            };
            if (live)
                return {
                    ...row,
                    problem: mainProcessFailure
                        ? 'a main process module did not start: ' + mainProcessFailure
                        : live.problem || null,
                };
            // One starting for the first time, or restarting here, is not yet anything but that: its spinner says so.
            // One that only is not running says so as a state, not as a failure.
            const here = !restarting.has(entry.id);
            const failed = entry.refusal?.message || (here && (run?.problem || run?.refusal?.message)) || null;
            const state = here && run?.state !== 'launching' ? STATE_WORDS[run?.state ?? 'notRunning'] : null;
            return { ...row, notLoaded: failed || state, failed: !!failed };
        });
    }

    // Each interface the mod `id` uses, `{ interface, major, owner, name, problem }`: the interface's owner, and its
    // name among the providers, absent where the mod itself owns it or none does.
    function usesOf(id, interfaces) {
        return interfaces.flatMap((queue) =>
            queue.clients
                .filter((client) => client.id === id)
                .map(({ major, problem }) => {
                    const owner = queue.owner && queue.owner !== id ? queue.owner : null;
                    const name = owner ? (queue.providers.find((one) => one.id === owner)?.name ?? null) : null;
                    return { interface: queue.interface, major, owner, name, problem };
                })
        );
    }
}

module.exports = { modsSection };
