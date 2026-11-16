// A mod with a window, which asks a main process module of its own whether it finds the window its page is shown in,
// installs the folder the test hands it as a person would, by a press in its window, opens the mods the test names as
// a person opens one the Dock does not keep, opens the file the test names through deckit/urls, and takes files
// dropped on it, and draws one of each part of the kit in its window while the test asks for them. It is a system
// mod, which the test ships with the app: it opens the switcher by its command and binds another mod's key again
// through the system's services.
class WindowProbe {
    attach(shell, deckit, { mainProcess }) {
        const marks = document.documentElement.dataset;
        const install = document.createElement('button');
        install.id = 'install';
        install.textContent = 'Install';
        const drop = document.createElement('div');
        drop.id = 'drop';
        Object.assign(drop.style, { width: '200px', height: '120px' });
        const content = document.createElement('div');
        content.append(install, drop);
        this.open = () => shell.windows.open({ name: 'probe', content });
        this.open();
        shell.dropDestination(drop, {
            onDrop: (paths, at) => (marks.dropped = JSON.stringify({ paths, at })),
            onTargeted: (on) => (marks.targeted = (marks.targeted || '') + (on ? 'on ' : 'off ')),
        });
        let from = '';
        document.addEventListener('test-install-from', ({ detail }) => (from = detail));
        install.addEventListener('click', () =>
            deckit.mods.install(from).then(
                ({ id }) => (marks.installed = id),
                (error) => (marks.installed = 'failed: ' + error.message)
            )
        );
        document.addEventListener('test-load', ({ detail: ids }) =>
            Promise.all(ids.map((id) => deckit.mods.launch(id))).then(
                () => (marks.loaded = ids.join()),
                (error) => (marks.loaded = 'failed: ' + error.message)
            )
        );
        let commands = null;
        let keys = null;
        let urls = null;
        deckit.dependencies.onConnect('deckit/commands', (connected) => {
            commands = connected;
            return () => (commands = null);
        });
        deckit.dependencies.onConnect('deckit/keys', (connected) => {
            keys = connected;
            return () => (keys = null);
        });
        deckit.dependencies.onConnect('deckit/urls', (connected) => {
            urls = connected;
            return () => (urls = null);
        });
        document.addEventListener('test-open', ({ detail: url }) =>
            urls?.open(url).then((opened) => (marks.opened = String(opened)))
        );
        document.addEventListener('test-switcher', () => commands?.run('switcher', 'show'));
        document.addEventListener('test-bind', ({ detail: { mod, command, keystroke } }) =>
            keys?.set(mod, command, keystroke).then(
                ({ chord }) => (marks.bound = chord),
                (error) => (marks.bound = 'failed: ' + error.message)
            )
        );
        let parts = null;
        document.addEventListener('test-kit', ({ detail: shown }) => {
            parts?.remove();
            parts = shown ? partsOf(shell.ui) : null;
            if (parts) content.append(parts);
        });
        document.addEventListener('test-stack', async () => {
            const probe = await mainProcess.start('main-process/stack.js');
            marks.found = String(await probe.found());
        });
    }

    reopen() {
        this.open?.();
    }

    detach() {
        this.open = null;
    }
}

// One of each part of the kit that reads as something, each in a cell of its own, all in view at once.
function partsOf(ui) {
    const box = ui.element('div', {
        style: {
            position: 'fixed',
            inset: '0',
            zIndex: '1',
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'flex-start',
            gap: '4px',
            background: 'canvas',
        },
    });
    const cell = (element) => {
        const made = ui.element('div', { style: { flex: '0 0 170px', minWidth: '0' } });
        made.append(element);
        return made;
    };
    const rowsOf = (list, chosen) => {
        const made = list({
            key: (name) => name,
            create: (name) => {
                const row = ui.row();
                row.element.append(name);
                if (chosen) row.setActive(name === chosen);
                return row.element;
            },
        });
        made.set(['one', 'two']);
        return made;
    };
    const tabs = ui.tabs({
        name: 'Tabs',
        key: (name) => name,
        create: (name) => {
            const tab = ui.element('div', { text: name });
            tabs.select(tab, name === 'one');
            return tab;
        },
    });
    tabs.set(['one', 'two']);
    const tree = ui.list({
        key: (item) => item.name,
        create: (item) => ui.treeRow({ ...item, open: true }).element,
    });
    ui.tree(tree.element, { name: 'Tree', items: () => [], lead: () => null, nameOf: String, onSelect: () => {} });
    tree.set([
        { name: 'src', folder: true },
        { name: 'a.js', depth: 1 },
    ]);
    const crumbs = ui.breadcrumb();
    const bar = ui.element('div');
    ui.titleBar(bar, { title: 'Bar' });
    bar.style.position = 'static';
    const on = () => {};
    box.append(
        ...[
            rowsOf((options) => ui.list({ ...options, name: 'Plain' }), null).element,
            rowsOf((options) => ui.list({ ...options, role: 'listbox', name: 'Chosen' }), 'two').element,
            tabs.element,
            tree.element,
            ui.field({ label: 'Name', placeholder: 'Type' }).element,
            ui.field({ placeholder: 'Find' }).element,
            ui.stepper({ label: 'Size', value: 12, min: 8, max: 20 }).element,
            ui.iconButton({ icon: ui.icon('plus', { size: 14 }), title: 'Add', onClick: on }).element,
            ui.rowAction({ icon: ui.icon('x', { size: 14 }), title: 'Close', onClick: on }).element,
            ui.toggleButton({ label: 'Aa', title: 'Match Case' }).element,
            ui.button({ label: 'Save', onClick: on }).element,
            ui.segmented({
                name: 'Mode',
                items: [
                    { key: 'a', label: 'Files' },
                    { key: 'b', label: 'Find' },
                ],
                value: 'a',
            }).element,
            ui.toggle({ label: 'Wrap', value: true }).element,
            ui.select({ label: 'Font', options: [{ value: 'x', label: 'Default' }], value: 'x' }).element,
            ui.section({ label: 'Group', collapsed: false }).element,
            crumbs.element,
            bar,
        ].map(cell)
    );
    crumbs.set([
        { key: 'a', label: 'Home' },
        { key: 'b', label: 'Here', current: true },
    ]);
    return box;
}

module.exports = WindowProbe;
