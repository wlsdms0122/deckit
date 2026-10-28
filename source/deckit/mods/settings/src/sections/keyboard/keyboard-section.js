const { chip } = require('../../chip/chip.js');
const { section } = require('../section/section.js');

// The Keyboard section: every mod's shortcuts, recorded anew by a click, with what keeps one from working. A card's
// name and whether it is the app's are its provider's, as `providerOf(id)` tells them.
function keyboardSection({ ui, keys, providerOf }) {
    const TITLE = 'Keyboard';
    const KEYWORDS = ['단축키', '키맵', '키보드', 'shortcuts', 'keymap', 'keyboard', 'keys'];
    const DESCRIPTION =
        'Click a shortcut to record a new one: Esc cancels, ⌫ clears it. Of shortcuts on one chord, the one that ' +
        'works in the fewest places runs there. A change onto a chord another uses in the same places is not ' +
        'applied until that chord is free.';
    const SCOPE_NAMES = { global: 'In every app', app: 'Anywhere in the app' };
    const APP = '@';

    let recording = null; // the key a chord is recorded for, and the end of its recording: { id, end }
    let drawAfterRecording = false;
    let drawing = 0;
    let providers = new Map(); // a provider's id -> { id, name, host }, as last drawn
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
        .settings-chord[data-conflicts] { border: 1px solid var(--deckit-alert); color: var(--deckit-alert); }
        .settings-chord[data-recording] { border-color: var(--deckit-accent); color: var(--deckit-accent); opacity: 1; }
        .settings-shortcut-line .settings-reset { opacity: 0.6; }
        .settings-shortcut-line .settings-reset[data-unchanged] { opacity: 0; pointer-events: none; }
        .settings-issue {
            padding: 0 0 5px;
            color: var(--deckit-alert);
            font: 11.5px var(--deckit-font);
            line-height: 1.45;
        }
    `);
    const { element, head, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const conflicts = chip({ ui, text: '' });
    const cards = ui.list({
        key: (group) => group.id,
        create: shortcutCard,
        update: (card, group) => cardFills.get(card)(group),
    });

    conflicts.element.classList.add('settings-conflicts');
    conflicts.element.hidden = true;
    head.append(conflicts.element);
    body.append(cards.element);
    return { element, title: TITLE, keywords: KEYWORDS, draw, stopRecording };

    // While a key is recorded the cards wait, and are drawn once it ends. A key that left the key map, its mod
    // stopped, ends its recording, as the chord would have no key to go to. A later drawing that starts while this
    // one reads the providers draws instead.
    async function draw(shortcuts) {
        if (recording && shortcuts.some((shortcut) => shortcut.id === recording.id)) {
            drawAfterRecording = true;
            return;
        }
        recording?.end();
        recording = null;
        drawAfterRecording = false;
        const turn = ++drawing;
        const ids = [
            ...new Set(
                shortcuts.flatMap(({ provider, issues }) => [provider, ...issues.map(({ other }) => other.provider)])
            ),
        ];
        const found = await Promise.all(ids.map((id) => providerOf(id)));
        if (turn !== drawing) return;
        providers = new Map(found.filter(Boolean).map((provider) => [provider.id, provider]));
        const conflicted = shortcuts.filter((shortcut) => shortcut.issues.length).length;
        conflicts.element.textContent = `${conflicted} conflict${conflicted === 1 ? '' : 's'}`;
        conflicts.element.hidden = !conflicted;
        // The hosts' keys are the app's: one card under its name.
        const cardOf = (shortcut) => (providers.get(shortcut.provider)?.host ? APP : shortcut.provider);
        cards.set(
            [...new Set(shortcuts.map(cardOf))].map((id) => {
                const held = shortcuts.filter((shortcut) => cardOf(shortcut) === id);
                return { id, name: providers.get(held[0].provider)?.name || held[0].provider, shortcuts: held };
            })
        );
    }

    function stopRecording() {
        recording?.end();
        recording = null;
        if (drawAfterRecording) draw(keys.list());
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
            onClick: () =>
                keys.reset(current.id).then(
                    () => draw(keys.list()),
                    () => draw(keys.list())
                ),
        });

        chord.type = 'button';
        chord.addEventListener('click', (event) => {
            event.stopPropagation();
            stopRecording();
            chord.textContent = 'Press a shortcut…';
            chord.toggleAttribute('data-recording', true);
            const end = keys.record((recorded) => {
                if (recorded.error) {
                    chord.textContent = recorded.error;
                    return;
                }
                recording = null;
                drawAfterRecording = false;
                const asked = recorded.spec || recorded.clear ? keys.bind(current.id, recorded.spec || '') : null;
                // A chord the key map refuses (one that cannot work everywhere for a key that does) says why on the
                // key, until it is drawn again.
                Promise.resolve(asked).then(
                    () => draw(keys.list()),
                    (error) => {
                        draw(keys.list());
                        chord.textContent = error.message;
                    }
                );
            });
            recording = { id: current.id, end };
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
            scope.textContent =
                SCOPE_NAMES[shortcut.scope] || (providers.get(shortcut.provider)?.host ? 'On any mod' : '');
            scope.hidden = !scope.textContent;
            chord.textContent = shortcut.spec ? shortcut.chord : 'None';
            chord.title = shortcut.changed ? `Changed from ${shortcut.defaultChord || 'none'}` : 'Click to change';
            chord.toggleAttribute('data-unset', !shortcut.spec);
            chord.removeAttribute('data-recording');
            chord.toggleAttribute('data-conflicts', shortcut.issues.length > 0);
            reset.element.title = `Back to ${shortcut.defaultChord || 'none'}`;
            reset.element.toggleAttribute('data-unchanged', !shortcut.changed);
            for (const note of notes) note.remove();
            notes = shortcut.issues.map((issue) =>
                ui.element('div', { className: 'settings-issue', text: issueText(shortcut, issue, providers) })
            );
            cell.append(...notes);
        }
    }
}

// What a keystroke does instead, in words, from an issue's facts and the providers of the keys.
function issueText(shortcut, { kind, other }, providers) {
    const provider = providers.get(other.provider);
    const name =
        provider?.host || other.provider === shortcut.provider
            ? other.label
            : `${provider?.name || other.provider} ${other.label}`;
    if (kind === 'held') return `Not applied: ${other.chord} is already ${name}`;
    return `Never runs: ${other.chord} is ${name}`;
}

module.exports = { keyboardSection };
