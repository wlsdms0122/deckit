// The Keyboard section: every plugin's shortcuts, recorded anew by a click, with what keeps one from working.
function keyboardSection({ ui, host }) {
    const SCOPE_NAMES = { global: 'Everywhere', panel: 'On any plugin' };

    let endRecording = null;

    const view = section({
        ui,
        title: 'Keyboard',
        description:
            'Click a shortcut to record a new one: Esc cancels, ⌫ clears it. Plugins may share a ' +
            'chord, since only one is on screen at a time. A change onto a chord already in use is not ' +
            'applied until that chord is free.',
    });
    const conflicts = chip({ ui, text: '' });
    const cards = ui.list({ key: (group) => group.owner, create: createCard });

    conflicts.classList.add('settings-conflicts');
    conflicts.hidden = true;
    view.head.append(conflicts);
    view.body.append(cards.element);
    return { element: view.element, title: view.title, draw, stopRecording };

    function draw() {
        stopRecording();
        const shortcuts = host.keymap.list();
        const errors = shortcuts.filter((shortcut) => shortcut.issues.some(isError)).length;
        conflicts.textContent = `${errors} conflict${errors === 1 ? '' : 's'}`;
        conflicts.hidden = !errors;
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

    function createCard(group) {
        const card = ui.element('div', { className: 'settings-card settings-shortcut-card' });
        const grid = ui.element('div', { className: 'settings-shortcuts' });
        grid.append(...group.shortcuts.map(shortcutCell));
        card.append(ui.element('div', { className: 'settings-card-title', text: group.name }), grid);
        return card;
    }

    function shortcutCell(shortcut) {
        const cell = ui.element('div', { className: 'settings-shortcut' });
        const line = ui.element('div', { className: 'settings-shortcut-line' });
        const name = ui.element('span', { className: 'settings-shortcut-name', text: shortcut.label });
        const chord = ui.element('button', {
            className: 'settings-chord',
            text: shortcut.spec ? shortcut.chord : 'None',
        });
        const reset = ui.rowAction({
            icon: ui.icon('reload', { size: 13 }),
            title: `Back to ${shortcut.defaultChord || 'none'}`,
            onClick: () => {
                host.keymap.reset(shortcut.id);
                draw();
            },
        });

        name.title = shortcut.label;
        line.append(name);
        if (SCOPE_NAMES[shortcut.scope])
            line.append(
                ui.element('span', { className: 'settings-shortcut-scope', text: SCOPE_NAMES[shortcut.scope] })
            );
        chord.type = 'button';
        chord.title = shortcut.changed ? `Changed from ${shortcut.defaultChord || 'none'}` : 'Click to change';
        chord.toggleAttribute('data-unset', !shortcut.spec);
        if (shortcut.issues.length) chord.dataset.level = shortcut.issues.some(isError) ? 'error' : 'warning';
        chord.addEventListener('click', (event) => {
            event.stopPropagation();
            stopRecording();
            chord.textContent = 'Press a shortcut…';
            chord.toggleAttribute('data-recording', true);
            endRecording = host.keymap.record((recorded) => {
                if (recorded.error) {
                    chord.textContent = recorded.error;
                    return;
                }
                endRecording = null;
                if (recorded.spec) host.keymap.set(shortcut.id, recorded.spec);
                else if (recorded.clear) host.keymap.set(shortcut.id, '');
                draw();
            });
        });
        reset.element.classList.add('settings-reset');
        reset.element.toggleAttribute('data-unchanged', !shortcut.changed);
        line.append(chord, reset.element);
        cell.append(line);
        for (const issue of shortcut.issues) {
            const note = ui.element('div', { className: 'settings-issue', text: issueText(shortcut, issue) });
            note.toggleAttribute('data-error', isError(issue));
            cell.append(note);
        }
        return cell;
    }

    function isError(issue) {
        return issue.level === 'error';
    }
}

// What a keystroke does instead, in words, from an issue's facts.
function issueText(shortcut, { kind, other }) {
    const name = other.deckit || other.owner === shortcut.owner ? other.label : `${other.ownerName} ${other.label}`;
    if (kind === 'held') return `Not applied: ${other.chord} is already ${name}`;
    if (kind === 'shadowed') return `Never runs: ${other.chord} is ${name}`;
    if (kind === 'hides') return `Hides ${other.label} while ${shortcut.ownerName} is on screen`;
    return `Not on ${other.ownerName}, where ${other.chord} is ${other.label}`;
}
