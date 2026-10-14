const { chip } = require('./chip.js');
const { section } = require('./section.js');

// The Keyboard section: every mod's shortcuts, recorded anew by a click, with what keeps one from working.
function keyboardSection({ ui, keymap }) {
    const TITLE = 'Keyboard';
    const KEYWORDS = ['단축키', '키맵', '키보드', 'shortcuts', 'keymap', 'keyboard', 'keys'];
    const DESCRIPTION =
        'Click a shortcut to record a new one: Esc cancels, ⌫ clears it. Mods may share a ' +
        'chord, since only one is on screen at a time. A change onto a chord already in use is not ' +
        'applied until that chord is free.';
    const SCOPE_NAMES = { global: 'Everywhere', shell: 'On any mod' };

    let endRecording = null;
    const cardFills = new WeakMap(); // card -> its fill(group)
    const cellFills = new WeakMap(); // shortcut cell -> its fill(shortcut)

    ui.addStyle(`
        .settings-chip.settings-conflicts {
            border-color: color-mix(in srgb, var(--deckit-alert) 50%, transparent);
            color: var(--deckit-alert);
            opacity: 1;
        }
        .settings-card.settings-shortcut-card { padding-bottom: 6px; }
        .settings-shortcuts {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            column-gap: 8px;
            padding: 0 4px;
        }
        .settings-shortcut { min-width: 0; padding: 0 8px; border-radius: var(--deckit-radius-control); }
        .settings-shortcut-line { display: flex; align-items: center; gap: 8px; min-height: 30px; }
        .settings-shortcut-name {
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font: var(--deckit-type-body);
        }
        .settings-shortcut-scope { flex: 0 0 auto; font: 11.5px var(--deckit-font); opacity: 0.4; }
        .settings-chord {
            flex: 0 0 auto;
            min-width: 56px;
            height: 22px;
            padding: 0 8px;
            border: var(--deckit-border);
            border-radius: 5px;
            background: transparent;
            color: inherit;
            font: var(--deckit-type-small);
            cursor: pointer;
        }
        .settings-chord[data-unset] { opacity: 0.45; }
        .settings-chord[data-level='warning'] { border: 1px solid var(--deckit-warn); color: var(--deckit-warn); }
        .settings-chord[data-level='error'] { border: 1px solid var(--deckit-alert); color: var(--deckit-alert); }
        .settings-chord[data-recording] { border-color: var(--deckit-accent); color: var(--deckit-accent); opacity: 1; }
        .settings-shortcut-line .settings-reset { opacity: 0.6; }
        .settings-shortcut-line .settings-reset[data-unchanged] { opacity: 0; pointer-events: none; }
        .settings-issue { padding: 0 0 5px; color: var(--deckit-warn); font: 11.5px var(--deckit-font); line-height: 1.45; }
        .settings-issue[data-error] { color: var(--deckit-alert); }
    `);
    const { element, head, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const conflicts = chip({ ui, text: '' });
    const cards = ui.list({
        key: (group) => group.owner,
        create: shortcutCard,
        update: (card, group) => cardFills.get(card)(group),
    });

    conflicts.element.classList.add('settings-conflicts');
    conflicts.element.hidden = true;
    head.append(conflicts.element);
    body.append(cards.element);
    return { element, title: TITLE, keywords: KEYWORDS, draw, stopRecording };

    function draw() {
        stopRecording();
        const shortcuts = keymap.list();
        const errors = shortcuts.filter((shortcut) => shortcut.issues.some(isError)).length;
        conflicts.element.textContent = `${errors} conflict${errors === 1 ? '' : 's'}`;
        conflicts.element.hidden = !errors;
        const owners = [...new Set(shortcuts.map((shortcut) => shortcut.owner))];
        cards.set(
            owners.map((owner) => {
                const owned = shortcuts.filter((shortcut) => shortcut.owner === owner);
                return { owner, name: owned[0].ownerName, shortcuts: owned };
            })
        );
    }

    function stopRecording() {
        endRecording?.();
        endRecording = null;
    }

    function shortcutCard(group) {
        const card = ui.element('div', { className: 'settings-card settings-shortcut-card' });
        const title = ui.element('div', { className: 'settings-card-title' });
        const cells = ui.list({
            key: (shortcut) => shortcut.id,
            create: shortcutCell,
            update: (cell, shortcut) => cellFills.get(cell)(shortcut),
        });

        cells.element.classList.add('settings-shortcuts');
        card.append(title, cells.element);
        cardFills.set(card, fill);
        fill(group);
        return card;

        function fill(group) {
            title.textContent = group.name;
            cells.set(group.shortcuts);
        }
    }

    function shortcutCell(shortcut) {
        let current = shortcut;
        let notes = [];

        const cell = ui.element('div', { className: 'settings-shortcut' });
        const line = ui.element('div', { className: 'settings-shortcut-line' });
        const name = ui.element('span', { className: 'settings-shortcut-name' });
        const scope = ui.element('span', { className: 'settings-shortcut-scope' });
        const chord = ui.element('button', { className: 'settings-chord' });
        const reset = ui.rowAction({
            icon: ui.icon('reload', { size: 13 }),
            title: '',
            onClick: () => {
                keymap.reset(current.id);
                draw();
            },
        });

        chord.type = 'button';
        chord.addEventListener('click', (event) => {
            event.stopPropagation();
            stopRecording();
            chord.textContent = 'Press a shortcut…';
            chord.toggleAttribute('data-recording', true);
            endRecording = keymap.record((recorded) => {
                if (recorded.error) {
                    chord.textContent = recorded.error;
                    return;
                }
                endRecording = null;
                if (recorded.spec) keymap.set(current.id, recorded.spec);
                else if (recorded.clear) keymap.set(current.id, '');
                draw();
            });
        });
        reset.element.classList.add('settings-reset');
        line.append(name, scope, chord, reset.element);
        cell.append(line);
        cellFills.set(cell, fill);
        fill(shortcut);
        return cell;

        function fill(shortcut) {
            current = shortcut;
            name.textContent = name.title = shortcut.label;
            scope.textContent = SCOPE_NAMES[shortcut.scope] || '';
            scope.hidden = !SCOPE_NAMES[shortcut.scope];
            chord.textContent = shortcut.spec ? shortcut.chord : 'None';
            chord.title = shortcut.changed ? `Changed from ${shortcut.defaultChord || 'none'}` : 'Click to change';
            chord.toggleAttribute('data-unset', !shortcut.spec);
            chord.removeAttribute('data-recording');
            if (shortcut.issues.length) chord.dataset.level = shortcut.issues.some(isError) ? 'error' : 'warning';
            else delete chord.dataset.level;
            reset.element.title = `Back to ${shortcut.defaultChord || 'none'}`;
            reset.element.toggleAttribute('data-unchanged', !shortcut.changed);
            for (const note of notes) note.remove();
            notes = shortcut.issues.map((issue) => {
                const note = ui.element('div', { className: 'settings-issue', text: issueText(shortcut, issue) });
                note.toggleAttribute('data-error', isError(issue));
                return note;
            });
            cell.append(...notes);
        }
    }

    function isError(issue) {
        return issue.level === 'error';
    }
}

// What a keystroke does instead, in words, from an issue's facts.
function issueText(shortcut, { kind, other }) {
    const name = other.shell || other.owner === shortcut.owner ? other.label : `${other.ownerName} ${other.label}`;
    if (kind === 'held') return `Not applied: ${other.chord} is already ${name}`;
    if (kind === 'shadowed') return `Never runs: ${other.chord} is ${name}`;
    if (kind === 'hides') return `Hides ${other.label} while ${shortcut.ownerName} is on screen`;
    return `Not on ${other.ownerName}, where ${other.chord} is ${other.label}`;
}

module.exports = { keyboardSection };
