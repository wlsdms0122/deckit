const { section } = require('../section/section.js');

// The Mod Settings section: a card per mod that declares a setting or sets buttons through Settings' exports,
// `setButtons(buttons)`, a control per setting and a row per button. `theme` is shell.theme, whose numbers a number
// left unset may inherit. `configuration()` is `deckit/configuration` while it is connected, and a setting is drawn
// from the hints its entry carries beside what Configuration reads. `sources` is what each mod set, `{ list, run }`,
// by its connection. A button gives its value to the `run` its mod set and shows under it the text that answers;
// `nameOf(mod)` names a card that has only buttons, and `iconOf(mod)` is the app icon before each card's name. A change
// that did not apply says why on its row's answer line.
function modSettingsSection({ ui, theme, configuration, sources, nameOf, iconOf }) {
    const TITLE = 'Mod Settings';
    const KEYWORDS = ['설정', '모드 설정', 'settings', 'preferences'];
    const DESCRIPTION =
        'Choices each mod offers. A mod declares them; what you choose is kept for it, so an update keeps it.';
    const HIGHLIGHT_LENGTH = 1200;
    // The kit's lists an entry's `choices` can name.
    const LISTS = ['textFonts', 'monospacedFonts'];
    // The theme's numbers an entry's `inherits` can name.
    const INHERITABLE = ['textSize'];
    // What a number left unset shows.
    const UNSET = 'Default';
    // The most characters a setting's choices may have, all labels together, to be drawn side by side.
    const SEGMENTED_LENGTH = 24;

    // As last drawn, for the commands, which cannot wait for a drawing.
    let groups = [];
    let drawing = 0;
    const cardFills = new WeakMap(); // card -> its fill(group)
    const rowFills = new WeakMap(); // setting row -> its fill(item)

    ui.addStyle(`
        .settings-setting-message { padding: 0 8px; color: var(--deckit-muted); font: var(--deckit-type-small); }
        .settings-setting-card { transition: background var(--deckit-fade) var(--deckit-easing); }
        .settings-setting-title { display: flex; align-items: center; gap: 8px; }
        .settings-setting-card[data-highlighted] {
            background: color-mix(in srgb, var(--deckit-accent) 12%, transparent);
        }
        .settings-setting-answer { color: var(--deckit-muted); font: var(--deckit-type-small); }
        .settings-setting-answer[data-failed] { color: var(--deckit-alert-ink); }
        .settings-setting-field { flex: 0 0 220px; }
    `);
    const { element, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const message = ui.element('div', { className: 'settings-setting-message' });
    const cards = ui.list({
        key: (group) => group.id,
        create: settingCard,
        update: (card, group) => cardFills.get(card)(group),
    });

    message.hidden = true;
    body.append(message, cards.element);
    return { element, title: TITLE, keywords: KEYWORDS, draw, groups: () => groups, cardOf, highlight };

    async function draw() {
        const turn = ++drawing;
        let read = null;
        let failure = '';
        try {
            const [configurations, buttons] = await Promise.all([configurationsOf(), buttonsOf()]);
            read = withButtons(configurations, buttons);
        } catch (error) {
            failure = error.message;
        }
        // A later drawing started while this one waited: it draws instead.
        if (turn !== drawing) return;
        if (!read) {
            cards.set([]);
            return showMessage('Could not read the mod settings: ' + failure);
        }
        groups = read;
        cards.set(read);
        showMessage(read.length ? '' : 'No mod has settings.');
    }

    // Each mod's settings as `deckit/configuration` lists them, each drawn with the hints its entry carries.
    async function configurationsOf() {
        if (!configuration()) throw new Error('the Configuration mod is not running');
        const { mods: listed } = await configuration().list();
        return listed.map(({ mod, items }) => ({
            id: mod.id,
            name: mod.name,
            items: items.map(({ entry, value }) => itemOf(entry, value)),
        }));
    }

    // The buttons each mod adds, `[mod id, buttons]`, each `{ button, hint, after, runs }`: `runs` is `{ mod, value }`,
    // the value that mod's `run` is given, and `after` the key of the setting it follows.
    function buttonsOf() {
        return Promise.all(
            [...sources].map(async ([connection, source]) => {
                const mod = connection.credential.mod;
                try {
                    const listed = typeof source.list === 'function' ? await source.list() : [];
                    return [mod, (Array.isArray(listed) ? listed : []).map((action) => buttonOf(mod, action))];
                } catch (error) {
                    console.error(`[settings] ${mod}'s buttons answered nothing`, error);
                    return [mod, []];
                }
            })
        ).then((read) => read.map(([mod, buttons]) => [mod, buttons.filter(Boolean)]));
    }

    // Each button follows the setting it names, in the order its mod gave them, and the rest end the card. A mod with
    // buttons and no settings has a card of its own.
    function withButtons(groups, buttons) {
        for (const [mod, given] of buttons) {
            if (!given.length) continue;
            let group = groups.find((group) => group.id === mod);
            if (!group) groups.push((group = { id: mod, name: nameOf(mod), items: [] }));
            const rows = given.map((button, index) => ({ ...button, key: `action\u0000${index}`, label: '' }));
            const keys = new Set(group.items.map((item) => item.key));
            group.items = [
                ...group.items.flatMap((item) => [item, ...rows.filter((row) => row.after === item.key)]),
                ...rows.filter((row) => !keys.has(row.after)),
            ];
        }
        return groups;
    }

    function cardOf(id) {
        return cards.elementOf(id);
    }

    // The card lights for a moment, since the cards around it look the same.
    function highlight(card) {
        card.toggleAttribute('data-highlighted', true);
        setTimeout(() => card.toggleAttribute('data-highlighted', false), HIGHLIGHT_LENGTH);
    }

    function showMessage(text) {
        message.textContent = text;
        message.hidden = !text;
    }

    function settingCard(group) {
        const card = ui.element('div', { className: 'settings-card settings-setting-card' });
        const title = ui.element('div', { className: 'settings-card-title settings-setting-title' });
        const rows = ui.list({
            key: (item) => item.key,
            create: (item) => settingRow(group.id, item),
            update: (row, item) => rowFills.get(row)(item),
        });

        card.append(title, rows.element);
        cardFills.set(card, fill);
        fill(group);
        return card;

        function fill(group) {
            title.replaceChildren(ui.appIcon(iconOf(group.id), { size: 'row' }), group.name);
            rows.set(group.items);
        }
    }

    // A kept row sets its control to the new value; a setting declared differently is given a new control.
    function settingRow(modId, item) {
        let current = item;
        let control = null;
        let shape = '';

        const row = ui.element('div', { className: 'settings-setting' });
        const words = ui.element('div', { className: 'settings-setting-words' });
        const label = ui.element('div', { className: 'settings-setting-label' });
        const hint = ui.element('div', { className: 'settings-setting-hint' });
        const answer = ui.element('div', { className: 'settings-setting-answer' });

        answer.hidden = true;
        words.append(label, hint, answer);
        row.append(words);
        rowFills.set(row, fill);
        fill(item);
        return row;

        function fill(item) {
            current = item;
            label.textContent = item.label;
            label.hidden = !item.label;
            hint.textContent = item.hint;
            hint.hidden = !item.hint;
            const declared = shapeOf(item);
            if (declared === shape) {
                // A button has no value: everything it shows is in its shape. A control being typed in keeps what is
                // typed.
                if (!item.runs && !control.element.contains(control.element.ownerDocument.activeElement))
                    control.set(valueOf(item));
                return;
            }
            shape = declared;
            const made = item.runs ? actionButton(item, answer) : controlOf(item, change);
            if (control) control.element.replaceWith(made.element);
            else row.append(made.element);
            control = made;
        }

        // The control shows what was kept: a number is kept within its bounds, and a refused value is not kept.
        // A refusal stays on the answer line until the next change.
        async function change(value) {
            control.set(value);
            tell('');
            try {
                if (!configuration()) throw new Error('the Configuration mod is not running');
                control.set(await configuration().setOf(modId, current.key, value));
            } catch (error) {
                control.set(valueOf(current));
                tell(`Not changed: ${error.message.replace(/\.$/, '')}.`, true);
            }
        }

        function tell(text, failed = false) {
            answer.textContent = text;
            answer.hidden = !text;
            answer.toggleAttribute('data-failed', failed);
        }
    }

    function controlOf(item, change) {
        const value = valueOf(item);
        if (item.type === 'boolean') return ui.toggle({ value, onChange: change });
        // Choices whose labels together are long take a select: side by side they would crowd out the words.
        const short = item.options.reduce((length, option) => length + option.label.length, 0) <= SEGMENTED_LENGTH;
        if (item.options.length && !item.listed && item.options.length <= 4 && short)
            return ui.segmented({
                items: item.options.map((option) => ({ key: option.value, label: option.label })),
                value,
                size: 'small',
                onChange: change,
            });
        if (item.options.length || item.listed) return ui.select({ options: item.options, value, onChange: change });
        // A number with no default may be left unset, stepping from what it inherits.
        if (item.type === 'number')
            return ui.stepper({
                value,
                min: item.minimum,
                max: item.maximum,
                step: item.step,
                unit: item.unit,
                unset: item.default === undefined ? { label: UNSET, value: item.inherited ?? item.minimum ?? 0 } : null,
                onChange: change,
            });
        const field = ui.field({
            value,
            placeholder: item.placeholder,
            size: 'small',
            onSubmit: (text) => change(text),
        });
        field.element.classList.add('settings-setting-field');
        field.input.addEventListener('blur', () => change(field.input.value));
        return field;
    }

    function actionButton(item, answer) {
        const { mod, value } = item.runs;
        return ui.button({
            label: item.button,
            onClick: async () => {
                answer.hidden = true;
                let text = '';
                let failed = false;
                try {
                    const source = [...sources].find(([connection]) => connection.credential.mod === mod)?.[1];
                    if (typeof source?.run !== 'function') throw new Error(`${nameOf(mod)} is not running`);
                    const said = await source.run(value);
                    text = typeof said === 'string' ? said : '';
                } catch (error) {
                    text = 'Did not work: ' + error.message;
                    failed = true;
                }
                answer.textContent = text;
                answer.hidden = !text;
                answer.toggleAttribute('data-failed', failed);
            },
        });
    }

    // What the control of `item` is set to. A value the kit's list does not have (a face chosen on another Mac) draws
    // as the default.
    function valueOf(item) {
        if (item.type === 'boolean') return !!item.value;
        if (item.listed) return item.options.some((option) => option.value === item.value) ? item.value : item.default;
        if (item.type === 'string' && !item.options.length) return item.value || '';
        return item.value ?? null;
    }

    // Everything a setting declares but its value: when it changes, the control is made again.
    function shapeOf(item) {
        return JSON.stringify({ ...item, value: null });
    }

    // A setting as its row draws it, from its entry as declared and `value`, what it reads as now: its options are its
    // `oneOf`, or for a string the list of the kit its `choices` names (`listed`); `inherited` is the theme's number
    // its `inherits` names, for a number. `step`, `unit` and `placeholder` are hints its entry carries for the control.
    function itemOf(entry, value) {
        const listed = entry.type === 'string' && LISTS.includes(entry.choices) ? ui[entry.choices]() : null;
        const choices = (entry.oneOf || []).map((choice) => ({
            value: choice.const,
            label: choice.title ?? String(choice.const),
        }));
        return {
            key: entry.key,
            type: entry.type,
            value,
            default: entry.default,
            label: entry.title || entry.key,
            hint: entry.description || '',
            options: listed || choices,
            listed: !!listed,
            minimum: entry.minimum,
            maximum: entry.maximum,
            step: typeof entry.step === 'number' && entry.step > 0 ? entry.step : 1,
            unit: typeof entry.unit === 'string' ? entry.unit : '',
            placeholder: typeof entry.placeholder === 'string' ? entry.placeholder : '',
            inherited: entry.type === 'number' && INHERITABLE.includes(entry.inherits) ? theme[entry.inherits] : null,
        };
    }
}

// A button as Settings reads it, or null for one with no label or no value to run.
function buttonOf(mod, action) {
    if (typeof action?.button !== 'string' || !action.button || action.value == null) return null;
    return {
        button: action.button,
        hint: typeof action.hint === 'string' ? action.hint : '',
        after: typeof action.after === 'string' ? action.after : '',
        runs: { mod, value: action.value },
    };
}

module.exports = { modSettingsSection };
