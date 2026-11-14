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
        let listed = []; // the app mods as the Dock last answered them
        let asked = 0; // the last time the Dock was asked, so an answer that came late is not drawn

        ui.addStyle(`
            .mods-page {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                overflow: hidden;
                color: var(--deckit-text);
                font: var(--deckit-type-body);
            }
            .mods-search { flex: 1 1 auto; max-width: 320px; margin-left: auto; }
            .mods-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 14px 16px; }
            .mods-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
                gap: 16px 8px;
            }
            .mods-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                min-width: 0;
                padding: 12px 8px;
                border: 0;
                border-radius: var(--deckit-radius-card);
                background: transparent;
                color: inherit;
                font: var(--deckit-type-body);
                cursor: pointer;
                transition: background-color var(--deckit-press-fade) var(--deckit-press-curve);
            }
            .mods-item:hover { background: var(--deckit-hover); }
            .mods-item:active .deckit-app-icon { filter: var(--deckit-shadow-icon) brightness(.85); }
            /* A name wraps to a second line before it is cut. */
            .mods-name {
                display: -webkit-box;
                max-width: 100%;
                overflow: hidden;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 2;
                overflow-wrap: anywhere;
                text-align: center;
            }
            .mods-none { padding: 24px 0; }
            .mods-none[hidden] { display: none; }
        `);
        const page = ui.element('div', { className: 'mods-page' });
        const head = ui.element('div', { className: 'mods-head' });
        const field = ui.field({
            placeholder: 'Search',
            icon: ui.icon('search', { size: 13 }),
            clearable: true,
            onInput: (value) => {
                query = value;
                show();
            },
            onSubmit: () => {
                const first = shown()[0];
                if (first) open(first.id);
            },
        });
        field.element.classList.add('mods-search');
        const body = ui.element('div', { className: 'mods-body' });
        const grid = ui.element('div', { className: 'mods-grid' });
        const empty = ui.emptyState({ icon: ui.icon('search', { size: 24 }) });
        const none = empty.element;
        none.classList.add('mods-none');
        // Why the mods could not be listed, where they would be.
        const failure = ui.notice({});
        failure.element.style.display = 'none';
        head.append(field.element);
        body.append(failure.element, grid, none);
        page.append(head, body);
        ui.titleBar(head, { title: 'Mods', scroller: body });
        ui.contextMenu(grid, {
            rowAt: (target) => target?.closest?.('.mods-item'),
            items: (item) => {
                const mod = item && listed.find(({ id }) => id === item.dataset.modId);
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
            return search(listed, query);
        }

        // The Dock asked again, then shown.
        async function draw() {
            const now = ++asked;
            let answered;
            try {
                answered = await dock.list();
            } catch (error) {
                if (now !== asked) return;
                grid.replaceChildren();
                none.hidden = true;
                failure.set({
                    text: 'Could not list the mods.',
                    details: error.message,
                    action: { label: 'Try Again', run: draw },
                });
                failure.element.style.display = '';
                return;
            }
            if (now !== asked) return;
            listed = answered;
            show();
        }

        function show() {
            const mods = shown();
            failure.element.style.display = 'none';
            grid.replaceChildren(...mods.map(itemOf));
            none.hidden = mods.length > 0;
            const settings = ui.button({
                label: 'Open Settings',
                size: 'small',
                variant: 'primary',
                onClick: () => open('settings'),
            });
            empty.set({
                title: query ? `No mod named “${query}”` : 'No mods to open',
                hint: query ? 'Install more in Settings.' : 'Install a mod in Settings.',
                actions: [settings.element],
            });
        }

        function itemOf(mod) {
            const item = ui.element('button', { className: 'mods-item' });
            item.type = 'button';
            item.dataset.modId = mod.id;
            item.title = mod.name;
            const icon = ui.appIcon(mod.icon, { size: 'grid' });
            // Whether it runs, the Dock shows.
            const name = ui.element('span', { className: 'mods-name', text: mod.name });
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
            dock.open(id).catch((error) => ui.toast(`Could not open it: ${error.message}`, { kind: 'failure' }));
        }

        function keep(id, pinned) {
            dock.setPinned(id, pinned).then(draw, (error) => ui.toast(error.message, { kind: 'failure' }));
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
