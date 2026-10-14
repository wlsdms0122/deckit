const { section } = require('./section.js');

// The Mod Settings section: a card per mod that declares settings, a control per setting. `onFailure` hears a
// change that did not apply.
function modSettingsSection({ ui, modSettings, onFailure }) {
    const TITLE = 'Mod Settings';
    const KEYWORDS = ['설정', '모드 설정', 'settings', 'preferences'];
    const DESCRIPTION =
        'Choices each mod offers. A mod declares them; they are kept with its data, so an update keeps them.';
    const HIGHLIGHT_LENGTH = 1200;
    // A setting of a type this section does not know draws nothing.
    const TYPES = ['toggle', 'choice', 'number', 'text', 'action'];

    // As last drawn, for the commands, which cannot wait for a drawing.
    let groups = [];
    let drawing = 0;
    const cardFills = new WeakMap(); // card -> its fill(group)
    const rowFills = new WeakMap(); // setting row -> its fill(item)

    ui.addStyle(`
        .settings-setting-message { padding: 0 8px; font: 12.5px var(--deckit-font); opacity: 0.45; }
        .settings-setting-card { transition: background var(--deckit-slow) var(--deckit-easing); }
        .settings-setting-card[data-highlighted] {
            background: color-mix(in srgb, var(--deckit-accent) 12%, transparent);
        }
        .settings-setting { display: flex; align-items: center; gap: 12px; min-height: 36px; padding: 4px 12px; }
        .settings-setting-words { display: flex; flex: 1 1 auto; flex-direction: column; gap: 1px; min-width: 0; }
        .settings-setting-label { font: var(--deckit-type-body); }
        .settings-setting-hint { font: var(--deckit-type-small); line-height: 1.45; opacity: 0.5; }
        .settings-setting-answer { font: var(--deckit-type-small); line-height: 1.45; opacity: 0.6; }
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
            read = (await modSettings.list()).map((group) => ({
                ...group,
                items: group.items.map(withDefaults),
            }));
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
        const title = ui.element('div', { className: 'settings-card-title' });
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
            title.textContent = group.name;
            rows.set(group.items.filter((item) => TYPES.includes(item.type)));
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
            hint.textContent = item.hint;
            hint.hidden = !item.hint;
            const declared = shapeOf(item);
            if (declared === shape) {
                // An action has no value: everything it shows is in its shape.
                if (item.type !== 'action') control.set(valueOf(item));
                return;
            }
            shape = declared;
            const made = item.type === 'action' ? actionButton(modId, item, answer) : controlOf(item, change);
            if (control) control.element.replaceWith(made.element);
            else row.append(made.element);
            control = made;
        }

        async function change(value) {
            control.set(value);
            try {
                await modSettings.set(modId, current.key, value);
            } catch (error) {
                onFailure('Could not change the setting: ' + error.message);
            }
        }
    }

    function controlOf(item, change) {
        const value = valueOf(item);
        if (item.type === 'toggle') return ui.toggle({ value, onChange: change });
        // `absent`: a saved value no longer among the choices, labeled so it does not read as nothing chosen.
        const options =
            item.type === 'choice'
                ? item.options.map((option) =>
                      option.absent ? { ...option, label: option.label + ' (not available)' } : option
                  )
                : [];
        if (item.type === 'choice' && !item.computed && options.length <= 4)
            return ui.segmented({
                items: options.map((option) => ({ key: option.value, label: option.label })),
                value,
                size: 'small',
                onChange: change,
            });
        if (item.type === 'choice') return ui.select({ options, value, onChange: change });
        if (item.type === 'number')
            return ui.stepper({
                value,
                min: item.min,
                max: item.max,
                step: item.step || 1,
                unit: item.unit,
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

    function actionButton(modId, item, answer) {
        return ui.button({
            label: item.button,
            title: item.label,
            onClick: async () => {
                answer.hidden = true;
                let text = '';
                try {
                    text = await modSettings.run(modId, item.key);
                } catch (error) {
                    text = 'Did not work: ' + error.message;
                }
                answer.textContent = text;
                answer.hidden = !text;
            },
        });
    }

    // What the control of `item` is set to.
    function valueOf(item) {
        if (item.type === 'toggle') return !!item.value;
        if (item.type === 'text') return item.value || '';
        return item.value;
    }

    // Everything a setting declares but its value: when it changes, the control is made again.
    function shapeOf(item) {
        return JSON.stringify({ ...item, value: null });
    }

    function withDefaults(item) {
        return {
            ...item,
            label: item.label || item.key,
            button: item.button || item.label || item.key,
            hint: item.hint || '',
            unit: item.unit || '',
            placeholder: item.placeholder || '',
        };
    }
}

module.exports = { modSettingsSection };
