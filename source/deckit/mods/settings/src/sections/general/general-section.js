const { section } = require('../section/section.js');

// The General section, what every mod follows: the face text is in and its size, which a page's text wears where
// nothing chooses another and a mod's own font settings follow while they are Default. `theme` is shell.theme, whose
// `fonts` are the ones the person chose, and `fonts` shell.fonts, which changes them. A change that did not apply is
// told in a toast.
function generalSection({ ui, theme, fonts }) {
    const TITLE = 'General';
    // The glyph beside the title in the sidebar.
    const GLYPH = 'sliders';
    const KEYWORDS = ['일반', '글꼴', '폰트', '글자 크기', 'general', 'fonts', 'font size', 'typeface'];
    const DESCRIPTION =
        'The font and size of text in every mod, wherever a mod does not choose its own. ' +
        "A mod's own font settings follow these while they are Default.";
    const DEFAULT = 'default';
    // The sizes fonts.set() takes.
    const SIZE = { min: 11, max: 22 };

    const { element, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const card = ui.element('div', { className: 'settings-card' });
    const rows = {
        text: choiceRow('text', {
            label: 'Font',
            hint: "The face of notes, files and any text a mod leaves unstyled. Default is the app's own.",
            optionsOf: () => ui.textFonts(),
        }),
        size: sizeRow({ label: 'Text size', hint: 'The size of that text.' }),
    };

    card.append(...Object.values(rows).map((row) => row.element));
    body.append(card);
    return { element, title: TITLE, glyph: GLYPH, keywords: KEYWORDS, draw };

    // The faces installed are read again, so a face installed since is offered.
    function draw() {
        show(theme.fonts);
    }

    // The size shown is the one text is in now, the default's where none was chosen.
    function show(kept) {
        rows.text.set(kept.text);
        rows.size.set(kept.size ?? theme.textSize);
    }

    // `optionsOf()` answers the choices; a value kept that is not among them (a face chosen on another Mac) is labeled
    // so it does not read as nothing chosen.
    function choiceRow(key, { label, hint, optionsOf }) {
        const select = ui.select({ options: optionsOf(), value: DEFAULT, onChange: (value) => change(key, value) });
        return { element: settingRow(label, hint, select.element), set };

        function set(value) {
            const options = optionsOf();
            const chosen = value ?? DEFAULT;
            const absent = !options.some((option) => option.value === chosen);
            select.setOptions(absent ? [...options, { value: chosen, label: `${chosen} (not available)` }] : options);
            select.set(chosen);
        }
    }

    function sizeRow({ label, hint }) {
        const stepper = ui.stepper({
            value: theme.textSize,
            ...SIZE,
            unit: ' px',
            onChange: (value) => change('size', value),
        });
        return { element: settingRow(label, hint, stepper.element), set: stepper.set };
    }

    function settingRow(label, hint, control) {
        const row = ui.element('div', { className: 'settings-setting' });
        const words = ui.element('div', { className: 'settings-setting-words' });
        words.append(
            ui.element('div', { className: 'settings-setting-label', text: label }),
            ui.element('div', { className: 'settings-setting-hint', text: hint })
        );
        row.append(words, control);
        return row;
    }

    // The fonts are set whole, the one changed and the other as it is; the controls show what was kept.
    async function change(key, value) {
        rows[key].set(value);
        const next = { ...theme.fonts, [key]: value };
        if (value === DEFAULT) delete next[key];
        try {
            show(await fonts.set(next));
        } catch (error) {
            draw();
            ui.toast('Could not change the fonts: ' + error.message);
        }
    }
}

module.exports = { generalSection };
