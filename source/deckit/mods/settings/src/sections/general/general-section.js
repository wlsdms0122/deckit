const { section } = require('../section/section.js');

// The General section, what every mod follows: the face text is written in and its size, which every page's theme
// wears and a mod's own font settings follow while they are Default. `theme` is shell.theme, `fonts`
// shell.fonts; `onFailure` hears a change that did not apply.
function generalSection({ ui, theme, fonts, onFailure }) {
    const TITLE = 'General';
    const KEYWORDS = ['일반', '글꼴', '폰트', '글자 크기', 'general', 'fonts', 'font size', 'typeface'];
    const DESCRIPTION =
        "What every mod follows: the face and the size text is written in, such as a note or a file. A mod's own " +
        'font settings follow these while they are Default.';
    const DEFAULT = 'default';
    // The sizes fonts.set() takes.
    const SIZE = { min: 11, max: 22 };

    ui.addStyle(`
        .settings-font { display: flex; align-items: center; gap: 12px; min-height: 36px; padding: 4px 12px; }
        .settings-font-label { flex: 1 1 auto; min-width: 0; font: var(--deckit-type-body); }
    `);
    const { element, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const card = ui.element('div', { className: 'settings-card' });
    const rows = {
        text: choiceRow('text', 'Font', () => ui.textFonts()),
        size: sizeRow(),
    };

    card.append(...Object.values(rows).map((row) => row.element));
    body.append(card);
    return { element, title: TITLE, keywords: KEYWORDS, draw };

    // The faces installed are read again, so a face installed since is offered.
    function draw() {
        show(fonts.get());
    }

    // The size shown is the one text is in now, the default's where none was chosen.
    function show(kept) {
        rows.text.set(kept.text);
        rows.size.set(kept.size ?? theme.textSize);
    }

    // `optionsOf()` answers the choices; a value kept that is not among them (a face chosen on another Mac) is labeled
    // so it does not read as nothing chosen.
    function choiceRow(key, label, optionsOf) {
        const row = ui.element('div', { className: 'settings-font' });
        const select = ui.select({ options: optionsOf(), value: DEFAULT, onChange: (value) => change(key, value) });

        row.append(ui.element('div', { className: 'settings-font-label', text: label }), select.element);
        return { element: row, set };

        function set(value) {
            const options = optionsOf();
            const chosen = value ?? DEFAULT;
            const absent = !options.some((option) => option.value === chosen);
            select.setOptions(absent ? [...options, { value: chosen, label: `${chosen} (not available)` }] : options);
            select.set(chosen);
        }
    }

    function sizeRow() {
        const row = ui.element('div', { className: 'settings-font' });
        const stepper = ui.stepper({
            value: theme.textSize,
            ...SIZE,
            unit: ' px',
            onChange: (value) => change('size', value),
        });

        row.append(ui.element('div', { className: 'settings-font-label', text: 'Text size' }), stepper.element);
        return { element: row, set: stepper.set };
    }

    // The controls show what was kept.
    async function change(key, value) {
        rows[key].set(value);
        try {
            show(await fonts.set({ [key]: value === DEFAULT ? null : value }));
        } catch (error) {
            draw();
            onFailure('Could not change the fonts: ' + error.message);
        }
    }
}

module.exports = { generalSection };
