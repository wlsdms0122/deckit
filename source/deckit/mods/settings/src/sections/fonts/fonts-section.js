const { section } = require('../section/section.js');

// The Fonts section: the face text is written in, the fixed-width face and the size, which every page's theme wears
// and a mod's own font settings follow while they are Default. `fonts` is deck.fonts; `onFailure` hears a change that
// did not apply.
function fontsSection({ ui, fonts, onFailure }) {
    const TITLE = 'Fonts';
    const KEYWORDS = ['글꼴', '폰트', '글자 크기', 'fonts', 'font size', 'typeface', 'monospaced'];
    const DESCRIPTION =
        "The faces and the size text is written in, such as a note or a file in the Editor. A mod's own font " +
        'settings follow these while they are Default.';
    const DEFAULT = 'default';
    const SIZES = [
        { value: DEFAULT, label: 'Default' },
        ...Array.from({ length: 12 }, (_, index) => ({ value: 11 + index, label: `${11 + index} px` })),
    ];

    ui.addStyle(`
        .settings-font { display: flex; align-items: center; gap: 12px; min-height: 36px; padding: 4px 12px; }
        .settings-font-label { flex: 1 1 auto; min-width: 0; font: var(--deckit-type-body); }
    `);
    const { element, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const card = ui.element('div', { className: 'settings-card' });
    const rows = {
        text: choiceRow('text', 'Font', () => ui.textFonts()),
        mono: choiceRow('mono', 'Monospaced font', () => ui.monospacedFonts()),
        size: choiceRow('size', 'Size', () => SIZES),
    };

    card.append(...Object.values(rows).map((row) => row.element));
    body.append(card);
    return { element, title: TITLE, keywords: KEYWORDS, draw };

    // The faces installed are read again, so a face installed since is offered.
    function draw() {
        show(fonts.get());
    }

    function show(kept) {
        for (const [key, row] of Object.entries(rows)) row.set(kept[key]);
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

module.exports = { fontsSection };
