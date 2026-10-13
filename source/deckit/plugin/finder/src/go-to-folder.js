const { kindIconOf } = require('./icon-cache.js');
const { parentOf } = require('./path.js');

// Go to Folder: a path typed, `~` for the home folder and relative to the tab's folder, with what is in the folder
// typed so far listed under it. Tab completes to the suggestion, the arrows move through them, Enter goes. A file goes
// to its folder, selected there: `onGo(folder, file)`.
function goToFolder({ ui, disk, tildify, homeLocation, location, onGo }) {
    const SUGGESTED = 8;
    // A wait shorter than this shows nothing, so a quick answer does not flash the spinner.
    const WAIT_SHOWN_AFTER = 120; // milliseconds
    const STYLE = `
        .finder-goto-icon { display: flex; flex: 0 0 auto; }
        .finder-goto-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    `;

    ui.addStyle(STYLE);

    return { show };

    function show() {
        const read = new Map(); // folder -> its entries, read once while the panel is up
        let suggestions = []; // { path, name, folder, entry }
        let problem = '';
        let unsuggested = ''; // why the list is empty
        let turn = 0;
        let reading = false; // the folder typed is being read: its suggestions are not in yet
        let up = true; // the panel is up: one closed meanwhile goes nowhere
        const picker = ui.quickPick({
            placeholder: 'Go to Folder',
            value: startText(),
            key: (suggestion) => suggestion.path,
            create: rowOf,
            onInput: () => {
                problem = '';
                suggest();
            },
            onPick: (suggestion) => go(suggestion.path),
            // The typed path, unless the arrows chose a suggestion.
            onEnter: ({ item }) => go(item ? item.path : resolved(picker.field.value)),
            onKey,
            onClose: () => (up = false),
        });
        suggest();

        function onKey(event) {
            if (event.key !== 'Tab' || event.shiftKey || !(reading || suggestions.length)) return false;
            if (!reading) complete(suggestions[Math.max(0, picker.active())]);
            return true;
        }

        function complete(suggestion) {
            picker.field.value = tildify(suggestion.path) + (suggestion.folder ? '/' : '');
            suggest();
        }

        // What the folder typed so far holds, starting with what follows its last slash.
        async function suggest() {
            const mine = ++turn;
            const text = picker.field.value;
            const slash = text.lastIndexOf('/');
            const folder = resolved(slash < 0 ? '.' : text.slice(0, slash + 1) || '/');
            const start = text.slice(slash + 1).toLowerCase();
            reading = true;
            const entries = folder ? await waiting(entriesOf(folder), 'Reading the folder…', () => mine === turn) : [];
            if (mine !== turn || !up) return;
            reading = false;
            suggestions = (entries ?? [])
                .filter((entry) => entry.name.toLowerCase().startsWith(start))
                .filter((entry) => start.startsWith('.') || !entry.name.startsWith('.'))
                .sort((a, b) => (b.kind === 'folder') - (a.kind === 'folder') || a.name.localeCompare(b.name))
                .slice(0, SUGGESTED)
                .map((entry) => ({ path: entry.path, name: entry.name, folder: entry.kind === 'folder', entry }));
            const where = folder && `“${tildify(folder)}”`;
            unsuggested = !folder
                ? 'Type a path'
                : !entries
                  ? `${where} can’t be read`
                  : start
                    ? `Nothing in ${where} starts with “${start}”`
                    : `${where} is empty`;
            draw();
        }

        // No suggestion is active until the arrows choose one.
        function draw() {
            picker.set(suggestions, { active: -1, message: problem || (suggestions.length ? '' : unsuggested) });
        }

        // `promise` answered, with a spinner and `text` under the list once it takes a while and while `current()`.
        async function waiting(promise, text, current) {
            const timer = setTimeout(() => {
                if (up && current()) picker.set([], { active: -1, message: text, loading: true });
            }, WAIT_SHOWN_AFTER);
            try {
                return await promise;
            } finally {
                clearTimeout(timer);
            }
        }

        // Null for a folder that cannot be read.
        async function entriesOf(folder) {
            if (!read.has(folder))
                read.set(
                    folder,
                    disk.list(folder).catch(() => null)
                );
            return read.get(folder);
        }

        // A path that is not there keeps the panel up and says so.
        async function go(path) {
            if (!path) return;
            const asked = turn;
            const kind = await waiting(
                disk.exists(path).catch(() => null),
                `Looking for “${tildify(path)}”…`,
                () => asked === turn
            );
            if (!up) return;
            if (!kind) {
                problem = `“${tildify(path)}” can’t be found.`;
                return draw();
            }
            picker.close();
            if (kind === 'folder') onGo(path, null);
            else onGo(parentOf(path), path);
        }
    }

    function rowOf({ name, folder, entry }) {
        const row = ui.row({ size: 'small' });
        const icon = ui.element('span', { className: 'finder-goto-icon' });
        icon.innerHTML = folder ? ui.folderIcon({ open: false, size: 14 }) : ui.icon(kindIconOf(entry), { size: 14 });
        row.element.append(icon, ui.element('span', { className: 'finder-goto-name', text: name }));
        return row.element;
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
