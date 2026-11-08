const { search } = require('./search/search.js');

// Every app mod, found by its name and keywords, in a grid in Mods' window: picking one opens it, and its menu keeps
// it in the Dock or takes it out. `shell.mods` is the shell's Dock, which says which mods there are to open.
class Mods {
    // Opens Mods' window, or orders it front where it is open, while Mods is attached.
    openWindow = null;

    // The commands its manifest declares to `deckit/commands`, run from the exports for its id. `show` brings Mods'
    // window in front, opening it where it is closed, and one run while Mods is not attached says so.
    start(deckit) {
        const commands = {
            show: () => {
                if (!this.openWindow) throw new Error('Mods has no window to open');
                this.openWindow();
            },
        };
        deckit.exports.register({
            connect: () => ({
                runCommand: async (id) => {
                    if (!Object.hasOwn(commands, id)) throw new Error(`Mods has no command ${id}`);
                    await commands[id]();
                },
            }),
        });
    }

    attach(shell, deckit) {
        const { ui } = shell;
        const dock = shell.mods;
        let query = '';

        ui.addStyle(`
            .mods-page {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                overflow: hidden;
                color: var(--deckit-text);
                font: var(--deckit-type-medium);
            }
            .mods-head { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; padding: 10px 14px; }
            .mods-title { flex: 0 0 auto; font: 700 var(--deckit-type-large); }
            .mods-search { flex: 1 1 auto; max-width: 320px; margin-left: auto; }
            .mods-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 14px 16px; }
            .mods-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
                gap: 6px;
            }
            .mods-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                min-width: 0;
                padding: 12px 6px 10px;
                border: 0;
                border-radius: var(--deckit-radius-medium);
                background: transparent;
                color: inherit;
                font: var(--deckit-type-body);
                cursor: pointer;
                transition: background-color var(--deckit-fast) var(--deckit-easing);
            }
            .mods-item:hover { background: var(--deckit-hover); }
            .mods-item:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--deckit-focus); }
            .mods-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; }
            .mods-icon svg { width: 28px; height: 28px; }
            .mods-name { display: flex; align-items: center; gap: 4px; max-width: 100%; }
            .mods-name-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .mods-running {
                flex: 0 0 auto;
                width: 5px;
                height: 5px;
                border-radius: 50%;
                background: currentColor;
                opacity: 0.5;
            }
            .mods-none { padding: 24px 0; text-align: center; opacity: 0.45; }
        `);
        const page = ui.element('div', { className: 'mods-page' });
        const head = ui.element('div', { className: 'mods-head' });
        const field = ui.field({
            placeholder: 'Search',
            icon: ui.icon('search', { size: 14 }),
            size: 'small',
            clearable: true,
            onInput: (value) => {
                query = value;
                draw();
            },
            onSubmit: () => {
                const first = shown()[0];
                if (first) open(first.id);
            },
        });
        field.element.classList.add('mods-search');
        const body = ui.element('div', { className: 'mods-body' });
        const grid = ui.element('div', { className: 'mods-grid' });
        const none = ui.element('div', { className: 'mods-none', text: 'No mod matches.' });
        head.append(ui.element('div', { className: 'mods-title', text: 'Mods' }), field.element);
        body.append(grid, none);
        page.append(head, body);
        ui.titleBar(head);
        ui.contextMenu(grid, {
            rowAt: (target) => target?.closest?.('.mods-item'),
            items: (item) => {
                const mod = item && dock.list().find(({ id }) => id === item.dataset.modId);
                return mod && menuOf(mod);
            },
        });

        this.openWindow = () =>
            shell.windows.open({
                name: 'main',
                content: page,
                didAppear: () => {
                    draw();
                    field.focus();
                },
            });
        this.openWindow();
        deckit.mods.onChange(draw);

        // The mods `query` finds, best first.
        function shown() {
            return search(dock.list(), query, deckit.util);
        }

        function draw() {
            const mods = shown();
            grid.replaceChildren(...mods.map(itemOf));
            none.hidden = mods.length > 0;
        }

        function itemOf(mod) {
            const item = ui.element('button', { className: 'mods-item' });
            item.type = 'button';
            item.dataset.modId = mod.id;
            item.title = mod.name;
            const icon = ui.element('span', { className: 'mods-icon' });
            if (mod.icon) icon.append(ui.sanitizeIcon(mod.icon));
            const name = ui.element('span', { className: 'mods-name' });
            name.append(ui.element('span', { className: 'mods-name-text', text: mod.name }));
            if (mod.running) {
                const running = ui.element('span', { className: 'mods-running' });
                running.title = 'Running';
                name.append(running);
            }
            item.append(icon, name);
            item.addEventListener('click', () => open(mod.id));
            return item;
        }

        function menuOf(mod) {
            return [
                { label: 'Open', run: () => open(mod.id) },
                '-',
                mod.pinned
                    ? { label: 'Remove from Dock', run: () => keep(mod.id, false) }
                    : { label: 'Keep in Dock', run: () => keep(mod.id, true) },
            ];
        }

        function open(id) {
            dock.open(id).catch((error) => ui.toast(`Could not open it: ${error.message}`));
        }

        function keep(id, pinned) {
            dock.setPinned(id, pinned).then(draw, (error) => ui.toast(error.message));
        }
    }

    // Its Dock item pressed while its window is closed.
    reopen() {
        this.openWindow?.();
    }

    detach() {
        this.openWindow = null;
    }
}

module.exports = Mods;
