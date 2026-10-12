// The Plugin Settings section: a card per plugin that declares settings, a control per setting. `onFailure` hears a
// change that did not apply.
function pluginSettingsSection({ ui, host, onFailure }) {
    const HIGHLIGHT_LENGTH = 1200;

    // As last drawn, for the commands, which cannot wait for a drawing.
    let groups = [];
    let drawing = 0;

    const view = section({
        ui,
        title: 'Plugin Settings',
        description:
            'Choices each plugin offers. A plugin declares them; they are kept with its data, so an update keeps them.',
    });
    const message = ui.element('div', { className: 'settings-quiet' });
    const cards = ui.list({ key: (group) => group.id, create: createCard });

    message.hidden = true;
    view.body.append(message, cards.element);
    return { element: view.element, title: view.title, draw, groups: () => groups, cardOf, highlight };

    async function draw() {
        const turn = ++drawing;
        let read = null;
        let failure = '';
        try {
            read = (await host.pluginSettings.list()).map((group) => ({
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
            return showMessage('Could not read the plugin settings: ' + failure);
        }
        groups = read;
        cards.set(read);
        showMessage(read.length ? '' : 'No plugin has settings.');
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

    function createCard(group) {
        const card = ui.element('div', { className: 'settings-card settings-setting-card' });
        card.append(ui.element('div', { className: 'settings-card-title', text: group.name }));
        for (const item of group.items) {
            const row = settingRow(group.id, item);
            if (row) card.append(row);
        }
        return card;
    }

    // A setting of a type this page does not know draws nothing.
    function settingRow(pluginId, item) {
        const words = ui.element('div', { className: 'settings-setting-words' });
        words.append(ui.element('div', { className: 'settings-setting-label', text: item.label }));
        if (item.hint) words.append(ui.element('div', { className: 'settings-setting-hint', text: item.hint }));
        const control = item.type === 'action' ? actionButton(pluginId, item, words) : controlOf(item, change);
        if (!control) return null;
        const row = ui.element('div', { className: 'settings-setting' });
        row.append(words, control.element);
        return row;

        async function change(value) {
            control.set(value);
            try {
                await host.pluginSettings.set(pluginId, item.key, value);
            } catch (error) {
                onFailure('Could not change the setting: ' + error.message);
            }
        }
    }

    function controlOf(item, change) {
        if (item.type === 'toggle') return ui.toggle({ value: !!item.value, onChange: change });
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
                value: item.value,
                size: 'small',
                onChange: change,
            });
        if (item.type === 'choice') return ui.select({ options, value: item.value, onChange: change });
        if (item.type === 'number')
            return ui.stepper({
                value: item.value,
                min: item.min,
                max: item.max,
                step: item.step || 1,
                unit: item.unit,
                onChange: change,
            });
        if (item.type === 'text') {
            const field = ui.field({
                value: item.value || '',
                placeholder: item.placeholder,
                size: 'small',
                onSubmit: (value) => change(value),
            });
            field.element.classList.add('settings-setting-field');
            field.input.addEventListener('blur', () => change(field.input.value));
            return field;
        }
        return null;
    }

    function actionButton(pluginId, item, words) {
        const answer = ui.element('div', { className: 'settings-setting-answer' });
        answer.hidden = true;
        words.append(answer);
        return ui.button({
            label: item.button,
            title: item.label,
            onClick: async () => {
                answer.hidden = true;
                let text = '';
                try {
                    text = await host.pluginSettings.run(pluginId, item.key);
                } catch (error) {
                    text = 'Did not work: ' + error.message;
                }
                answer.textContent = text;
                answer.hidden = !text;
            },
        });
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
