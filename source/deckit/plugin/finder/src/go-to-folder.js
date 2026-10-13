const { kindIconOf } = require('./icon-cache.js');
const { parentOf } = require('./path.js');

// Go to Folder: a path typed, `~` for the home folder and relative to the tab's folder, with what is in the folder
// typed so far listed under it. Tab completes to the suggestion, the arrows move through them, Enter goes. A file goes
// to its folder, selected there: `onGo(folder, file)`.
function goToFolder({ ui, disk, tildify, homeLocation, location, onGo }) {
    const SUGGESTED = 8;
    const STYLE = `
        .finder-goto-suggestions { display: flex; flex-direction: column; margin-top: 8px; }
        .finder-goto-suggestions:empty { display: none; }
        .finder-goto-suggestion { cursor: pointer; }
        .finder-goto-suggestion-icon { display: flex; flex: 0 0 auto; }
        .finder-goto-suggestion-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .finder-goto-problem { margin-top: 8px; color: var(--deckit-alert); font: var(--deckit-type-small); }
        .finder-goto-problem:empty { display: none; }
    `;

    ui.addStyle(STYLE);

    return { show };

    // `text` and `problem` are what a Go that failed after the panel closed brings back.
    function show({ text = null, problem = '' } = {}) {
        const read = new Map(); // folder -> its entries, read once while the panel is up
        let suggestions = []; // { path, name, folder }
        let active = -1;
        let turn = 0;
        let reading = false; // the folder typed is being read: its suggestions are not in yet
        let up = true; // the panel is up: one closed meanwhile goes nowhere
        const field = ui.field({
            value: text ?? startText(),
            onInput: () => {
                said.textContent = '';
                suggest();
            },
        });
        const list = ui.element('div', { className: 'finder-goto-suggestions' });
        const said = ui.element('div', { className: 'finder-goto-problem', text: problem });
        const panel = ui.modal({
            title: 'Go to Folder',
            confirmLabel: 'Go',
            onKey,
            onConfirm: () => go(typedPath(), { closed: true }),
            onClose: () => (up = false),
            fill(card) {
                card.append(field.element, said, list);
                return field.input;
            },
        });
        suggest();

        function onKey(event) {
            if (event.target !== field.input) return false;
            if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
                const by = event.key === 'ArrowDown' ? 1 : -1;
                const count = suggestions.length;
                active = active < 0 ? (by > 0 ? 0 : count - 1) : (active + by + count) % count;
                draw();
                return true;
            }
            if (event.key === 'Tab' && !event.shiftKey && (reading || suggestions.length)) {
                if (!reading) complete(suggestions[Math.max(0, active)]);
                return true;
            }
            if (event.key === 'Enter') {
                go(active >= 0 ? suggestions[active].path : typedPath());
                return true;
            }
            return false;
        }

        function complete(suggestion) {
            field.set(tildify(suggestion.path) + (suggestion.folder ? '/' : ''));
            suggest();
        }

        // What the folder typed so far holds, starting with what follows its last slash.
        async function suggest() {
            const mine = ++turn;
            const text = field.input.value;
            const slash = text.lastIndexOf('/');
            const folder = resolved(slash < 0 ? '.' : text.slice(0, slash + 1) || '/');
            const start = text.slice(slash + 1).toLowerCase();
            reading = true;
            const entries = folder ? await entriesOf(folder) : [];
            if (mine !== turn) return;
            reading = false;
            suggestions = entries
                .filter((entry) => entry.name.toLowerCase().startsWith(start))
                .filter((entry) => start.startsWith('.') || !entry.name.startsWith('.'))
                .sort((a, b) => (b.kind === 'folder') - (a.kind === 'folder') || a.name.localeCompare(b.name))
                .slice(0, SUGGESTED)
                .map((entry) => ({ path: entry.path, name: entry.name, folder: entry.kind === 'folder', entry }));
            active = -1;
            draw();
        }

        function draw() {
            list.replaceChildren(
                ...suggestions.map((suggestion, index) => {
                    const row = ui.row({ size: 'small' });
                    row.element.classList.add('finder-goto-suggestion');
                    const icon = ui.element('span', { className: 'finder-goto-suggestion-icon' });
                    icon.innerHTML = suggestion.folder
                        ? ui.folderIcon({ open: false, size: 14 })
                        : ui.icon(kindIconOf(suggestion.entry), { size: 14 });
                    row.element.append(
                        icon,
                        ui.element('span', { className: 'finder-goto-suggestion-name', text: suggestion.name })
                    );
                    row.setActive(index === active);
                    // Before the field loses the focus.
                    row.element.addEventListener('mousedown', (event) => event.preventDefault());
                    row.element.addEventListener('click', () => go(suggestion.path));
                    return row.element;
                })
            );
        }

        async function entriesOf(folder) {
            if (!read.has(folder))
                read.set(
                    folder,
                    disk.list(folder).catch(() => [])
                );
            return read.get(folder);
        }

        function typedPath() {
            return resolved(field.input.value);
        }

        // A path that is not there keeps the panel up and says so, or opens it again when Go had closed it.
        async function go(path, { closed = false } = {}) {
            if (!path) return closed ? show({ text: field.input.value }) : undefined;
            const kind = await disk.exists(path).catch(() => null);
            if (!closed && !up) return;
            if (!kind) {
                const problem = `“${tildify(path)}” can’t be found.`;
                if (closed) return show({ text: field.input.value, problem });
                said.textContent = problem;
                return;
            }
            panel.close();
            if (kind === 'folder') onGo(path, null);
            else onGo(parentOf(path), path);
        }
    }

    // The tab's folder, to go on from.
    function startText() {
        const here = location();
        return here ? tildify(here) + (here === '/' ? '' : '/') : '';
    }

    // An absolute path for what is typed: `~` is the home folder, `~name` the home folder of `name` beside it, and a
    // path not from the root is from the tab's folder.
    function resolved(typed) {
        let text = typed.trim();
        if (!text) return null;
        if (text === '~' || text.startsWith('~/')) text = homeLocation() + text.slice(1);
        else if (text.startsWith('~')) text = parentOf(homeLocation()) + '/' + text.slice(1);
        else if (!text.startsWith('/')) text = (location() || homeLocation()) + '/' + text;
        const parts = [];
        for (const part of text.split('/')) {
            if (part === '..') parts.pop();
            else if (part && part !== '.') parts.push(part);
        }
        return '/' + parts.join('/');
    }
}

module.exports = { goToFolder };
