const { chip } = require('../../chip/chip.js');
const { section } = require('../section/section.js');

// The modifiers as a chord is written, in the order it writes them.
const MODIFIERS = [
    ['control', '⌃'],
    ['alt', '⌥'],
    ['shift', '⇧'],
    ['meta', '⌘'],
];
// A key that is no letter or digit, by its code, as a chord writes it.
const WRITTEN = {
    Backslash: '\\',
    BracketLeft: '[',
    BracketRight: ']',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Semicolon: ';',
    Quote: "'",
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    Space: 'Space',
    Enter: '↩',
    Tab: '⇥',
    Escape: '⎋',
    Backspace: '⌫',
    Delete: '⌦',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
};
// The codes of the modifiers themselves: a press of one alone is no chord yet.
const MODIFIER_CODES = /^(Meta|Control|Alt|Shift)(Left|Right)$|^(CapsLock|Fn|OS)/;

// The Keyboard section: the app's own keys (shell.keys, under `appName`, none where `list` is refused) and every mod's
// (`deckit/keys`, `keys()` while it is connected), recorded anew by a click through `shell.keys.record`, with what
// keeps one from working. `onChange` hears that a key was set here.
function keyboardSection({ ui, keys, shellKeys, appName, onChange }) {
    const TITLE = 'Keyboard';
    const KEYWORDS = ['단축키', '키맵', '키보드', 'shortcuts', 'keymap', 'keyboard', 'keys'];
    const DESCRIPTION =
        'Click a shortcut to record a new one: Esc cancels, ⌫ clears it. Of shortcuts on one chord, the first ' +
        'listed runs. A change onto a chord another uses in the same places is not applied until that chord is free.';
    // Two places a key works: in the app, a mod's window in front or none, or everywhere, the app in front or not.
    const SCOPE_NAMES = { global: 'Everywhere', app: `In ${appName}` };
    const APP = '\u0000app';

    let recording = null; // the key a chord is recorded for, and the end of its recording: { id, end }
    let drawAfterRecording = false;
    let appKeys = []; // the app's keys, as last drawn
    const cardFills = new WeakMap(); // card -> its fill(group)
    const cellFills = new WeakMap(); // shortcut cell -> its fill(shortcut)

    ui.addStyle(`
        .settings-chip.settings-conflicts {
            border-color: color-mix(in srgb, var(--deckit-alert) 50%, transparent);
            color: var(--deckit-alert-ink);
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
        .settings-shortcut-scope { flex: 0 0 auto; color: var(--deckit-muted); font: var(--deckit-type-small); }
        .settings-chord {
            flex: 0 0 auto;
            min-width: 56px;
            height: 24px;
            padding: 0 8px;
            border: var(--deckit-border);
            border-radius: var(--deckit-radius-control);
            background: transparent;
            color: inherit;
            font: var(--deckit-type-small);
            cursor: pointer;
        }
        .settings-chord[data-unset] { color: var(--deckit-muted); }
        .settings-chord[data-conflicts] { border: 1px solid var(--deckit-alert-ink); color: var(--deckit-alert-ink); }
        .settings-chord[data-recording] { border-color: var(--deckit-accent); color: var(--deckit-accent); }
        .settings-shortcut-line .settings-reset { color: var(--deckit-muted); }
        .settings-shortcut-line .settings-reset[data-unchanged] { opacity: 0; pointer-events: none; }
        .settings-issue {
            padding: 0 0 5px;
            color: var(--deckit-alert-ink);
            font: var(--deckit-type-small);
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
    return { element, title: TITLE, keywords: KEYWORDS, read, draw, stopRecording };

    // Every key and the mods' entries left out, `{ shortcuts, refused }`: `shortcuts` the app's first and then the
    // mods' in the order `deckit/keys` lists them, each `{ id, shell, mod, command, title, scope, keystroke,
    // defaultKeystroke, chord, changed, issues }` as `deckit/keys` lists one, `shell` whether it is the app's, which
    // has no `mod`, `scope` or `issues`; `refused` as `deckit/keys` lists them. What cannot be read gives none.
    async function read() {
        const unread = (what, none) => (error) => {
            console.warn(`[settings] could not read ${what}`, error);
            return none;
        };
        const none = { keys: [], refused: [] };
        const [own, declared] = await Promise.all([
            shellKeys.list().catch(unread("the app's keys", [])),
            keys() ? keys().list().catch(unread("the mods' keys", none)) : none,
        ]);
        return { shortcuts: [...own.map(shellShortcut), ...declared.keys.map(modShortcut)], refused: declared.refused };
    }

    // While a key is recorded the cards wait, and are drawn once it ends. A key that is gone ends its recording, as
    // the chord would have no key to go to.
    function draw(shortcuts) {
        if (recording && shortcuts.some((shortcut) => shortcut.id === recording.id)) {
            drawAfterRecording = true;
            return;
        }
        recording?.end();
        recording = null;
        drawAfterRecording = false;
        appKeys = shortcuts.filter((shortcut) => shortcut.shell);
        const conflicted = shortcuts.filter((shortcut) => shortcut.issues.length).length;
        conflicts.element.textContent = `${conflicted} conflict${conflicted === 1 ? '' : 's'}`;
        conflicts.element.hidden = !conflicted;
        // The app's keys are one card under its name, and each mod's one under the mod's.
        const cardOf = (shortcut) => (shortcut.shell ? APP : shortcut.mod.id);
        cards.set(
            [...new Set(shortcuts.map(cardOf))].map((id) => {
                const held = shortcuts.filter((shortcut) => cardOf(shortcut) === id);
                return { id, name: held[0].shell ? appName : held[0].mod.name, shortcuts: held };
            })
        );
    }

    function stopRecording() {
        recording?.end();
        recording = null;
        if (!drawAfterRecording) return;
        drawAfterRecording = false;
        onChange();
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
            onClick: () => resetKey(current).then(onChange, onChange),
        });

        chord.type = 'button';
        chord.addEventListener('click', (event) => {
            event.stopPropagation();
            stopRecording();
            chord.textContent = 'Press a shortcut…';
            chord.toggleAttribute('data-recording', true);
            const end = record(shellKeys.record, (keystroke) => {
                recording = null;
                const waited = drawAfterRecording;
                drawAfterRecording = false;
                if (keystroke === undefined) {
                    fill(current);
                    if (waited) onChange();
                    return;
                }
                // A chord the key's owner refuses (one the keymap's rule for a chord breaks, or one the app's keys
                // have) says why on the key, until it is drawn again.
                setKey(current, keystroke).then(onChange, async (error) => {
                    await onChange();
                    chord.textContent = error.message;
                });
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
            const defaultChord = shortcut.defaultKeystroke ? written(shortcut.defaultKeystroke) : 'none';
            name.textContent = name.title = shortcut.title;
            scope.textContent = shortcut.shell ? SCOPE_NAMES.app : SCOPE_NAMES[shortcut.scope] || '';
            scope.hidden = !scope.textContent;
            chord.textContent = shortcut.keystroke ? shortcut.chord : 'None';
            chord.title = shortcut.changed ? `Changed from ${defaultChord}` : 'Click to change';
            chord.toggleAttribute('data-unset', !shortcut.keystroke);
            chord.removeAttribute('data-recording');
            chord.toggleAttribute('data-conflicts', shortcut.issues.length > 0);
            reset.element.title = `Back to ${defaultChord}`;
            reset.element.toggleAttribute('data-unchanged', !shortcut.changed);
            for (const note of notes) note.remove();
            notes = shortcut.issues.map((issue) =>
                ui.element('div', { className: 'settings-issue', text: issueText(shortcut, issue, appKeyOn) })
            );
            cell.append(...notes);
        }
    }

    // `keystroke` for the key, or null for none, through whoever keeps it.
    async function setKey(shortcut, keystroke) {
        if (shortcut.shell) return shellKeys.set(shortcut.command, keystroke);
        if (!keys()) throw new Error('The keymap is not running');
        return keys().set(shortcut.mod.id, shortcut.command, keystroke);
    }

    // The app's key on the chord of `shortcut`, as `{ title }` with the app's name, or null.
    function appKeyOn(shortcut) {
        const found = appKeys.find((key) => sameChord(key.keystroke, shortcut.keystroke));
        return found ? { title: `${appName}'s ${found.title}` } : null;
    }

    async function resetKey(shortcut) {
        if (shortcut.shell) return shellKeys.reset(shortcut.command);
        if (!keys()) throw new Error('The keymap is not running');
        return keys().reset(shortcut.mod.id, shortcut.command);
    }
}

// The next press in the page that is not a modifier alone, as `recordKeys` (`shell.keys.record`) hands it, taken from
// whatever else would hear it, as `onRecorded(keystroke)`: `{ code, meta, control, alt, shift }`, null for ⌫ or ⌦
// alone, which clears the key, or undefined for Esc alone, which cancels. The recording stops at that press. Answers
// what ends it before.
function record(recordKeys, onRecorded) {
    const stop = recordKeys((keystroke) => {
        if (!keystroke.code || MODIFIER_CODES.test(keystroke.code)) return;
        stop();
        const bare = MODIFIERS.every(([name]) => !keystroke[name]);
        if (bare && keystroke.code === 'Escape') onRecorded(undefined);
        else if (bare && (keystroke.code === 'Backspace' || keystroke.code === 'Delete')) onRecorded(null);
        else onRecorded({ ...keystroke });
    });
    return stop;
}

// One of the app's keys as shell.keys lists it, `{ id, name, defaultKeystroke, keystroke }`, as the section draws a
// key.
function shellShortcut({ id, name, defaultKeystroke, keystroke }) {
    return {
        id: `shell\u0000${id}`,
        shell: true,
        mod: null,
        command: id,
        title: name,
        scope: null,
        keystroke,
        defaultKeystroke,
        chord: keystroke ? written(keystroke) : '',
        changed: !sameChord(keystroke, defaultKeystroke),
        issues: [],
    };
}

// A key as `deckit/keys` lists it, as the section draws a key.
function modShortcut(key) {
    return { ...key, id: `${key.mod.id}\u0000${key.command}`, shell: false };
}

// A keystroke as a person reads it: its modifiers, then its key, as `⌃⌘[`.
function written(keystroke) {
    const held = MODIFIERS.filter(([name]) => keystroke[name]).map(([, symbol]) => symbol);
    const { code } = keystroke;
    const name = WRITTEN[code] ?? (/^(Key|Digit)./.test(code) ? code.slice(code.startsWith('Key') ? 3 : 5) : code);
    return held.join('') + name;
}

// Whether two keystrokes, or nulls for none, are one chord.
function sameChord(one, other) {
    if (!one || !other) return !one && !other;
    return one.code === other.code && MODIFIERS.every(([name]) => !!one[name] === !!other[name]);
}

// What keeps a key from working, in words, from an issue `deckit/keys` lists, `other` the key that has its chord. A
// chord taken is the app's key that holds it, as `appKeyOn(shortcut)` finds it, or another mod's.
function issueText(shortcut, { kind, message, other }, appKeyOn) {
    const name = !other ? '' : other.mod.id === shortcut.mod.id ? other.title : `${other.mod.name} ${other.title}`;
    if (kind === 'held') return `Not applied: ${shortcut.chord} is already ${name}`;
    if (kind === 'shadowed') return `Never runs: ${shortcut.chord} is ${name}`;
    if (kind === 'taken') {
        const appKey = appKeyOn(shortcut);
        return `Never runs: ${shortcut.chord} is ${appKey ? appKey.title : 'taken by another mod'}`;
    }
    if (kind === 'unavailable') return `In the app only: the system does not give ${shortcut.chord}`;
    return message;
}

module.exports = { keyboardSection };
