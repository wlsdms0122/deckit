const { NO_VALUE, schemeName, patternText } = require('../../format/format.js');
const { section } = require('../section/section.js');
const { handlerRow } = require('../handler-list/handler-list.js');

// The URL Schemes section: a card per scheme `deckit/urls` lists (`urls()` while it is connected), with the mods that
// open its addresses in the turn they are offered one, and what opens it outside the app after them. The card's menu
// chooses what opens the scheme: a mod first, outside the app at once, or the mods in turn. A choice the service
// refuses is told on its card. `onChange` hears that a choice was made here.
function urlSchemesSection({ ui, urls, appName, onChange }) {
    const TITLE = 'URL Schemes';
    const KEYWORDS = [
        '열기',
        '링크',
        '파일 열기',
        '다음으로 열기',
        '스킴',
        'url scheme',
        'open with',
        'open link',
        'open file',
    ];
    const DESCRIPTION =
        'Addresses by their scheme, and the mods that open them. Mods are offered an address in turn, the one you ' +
        `choose first, and one may pass. When every mod passes, ${appName} opens it the default way, for a scheme it ` +
        'has one for, or you choose to open it that way at once.';
    const DEFAULT_ANSWERS = {
        browser: 'Opens in the system browser',
        file: "Opens in the system's app for the file",
    };
    // The menu's values beside a mod's id, which none is.
    const AUTOMATIC = null;
    const SYSTEM = '\u0000system';

    const cardFills = new WeakMap(); // card -> its fill(scheme)
    const rowFills = new WeakMap(); // mod row -> its fill(entry)
    const refusals = new Map(); // scheme -> why the service refused the choice last made for it

    ui.addStyle(`
        .settings-scheme-head { display: flex; align-items: center; gap: 8px; padding: 0 12px; }
        .settings-scheme-name { flex: 1 1 auto; min-width: 0; font: 600 var(--deckit-type-body); }
        .settings-scheme-description {
            padding: 1px 12px 6px;
            font: var(--deckit-type-small);
            color: var(--deckit-muted);
        }
        .settings-scheme-none {
            padding: 4px 12px 6px 44px;
            font: var(--deckit-type-small);
            color: var(--deckit-muted);
        }
        .settings-scheme-patterns {
            flex: 0 1 auto;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font: var(--deckit-type-small);
            color: var(--deckit-muted);
        }
        .settings-scheme-refusal {
            padding: 4px 12px 6px 44px;
            color: var(--deckit-alert-ink);
            font: var(--deckit-type-small);
            white-space: pre-wrap;
        }
    `);
    const { element, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const cards = ui.list({
        key: (scheme) => scheme.scheme,
        create: schemeCard,
        update: (card, scheme) => cardFills.get(card)(scheme),
    });

    body.append(cards.element);
    return { element, title: TITLE, keywords: KEYWORDS, read, draw };

    // Every scheme and the entries left out, as `deckit/urls` lists them, `{ schemes, refused }`, `schemes`
    // `[{ scheme, system, chosen, mods }]`; none while it cannot be read.
    async function read() {
        const none = { schemes: [], refused: [] };
        if (!urls()) return none;
        try {
            return await urls().list();
        } catch (error) {
            console.warn('[settings] could not read the schemes', error);
            return none;
        }
    }

    function draw(schemes) {
        cards.set(schemes);
    }

    function schemeCard(scheme) {
        let current = scheme;

        const card = ui.element('div', { className: 'settings-card' });
        const head = ui.element('div', { className: 'settings-scheme-head' });
        const opener = ui.select({
            options: [],
            value: AUTOMATIC,
            onChange: (value) => {
                opener.set(value);
                choose(current.scheme, value);
            },
        });
        const description = ui.element('div', {
            className: 'settings-scheme-description',
            text: schemeDescription(scheme.scheme),
        });
        const none = ui.element('div', { className: 'settings-scheme-none', text: 'No mod opens these.' });
        const list = ui.list({
            key: ({ mod }) => mod.id,
            create: modEntry,
            update: (row, entry) => rowFills.get(row)(entry),
        });
        const defaultRow = handlerRow({ ui, trailing: [] });
        const refusal = ui.element('div', { className: 'settings-scheme-refusal' });

        head.append(
            ui.element('div', { className: 'settings-scheme-name', text: schemeName(scheme.scheme) }),
            opener.element
        );
        card.append(head, description, none, list.element, defaultRow.element, refusal);
        cardFills.set(card, fill);
        fill(scheme);
        return card;

        function fill(scheme) {
            current = scheme;
            const { mods, chosen, system } = scheme;
            const outside = !!chosen?.system;
            const defaultAnswer = DEFAULT_ANSWERS[system];
            const first = mods[0];
            opener.setOptions([
                { value: AUTOMATIC, label: first && !chosen?.mod ? `Automatic: ${first.mod.name}` : 'Automatic' },
                ...mods.map(({ mod }) => ({ value: mod.id, label: `${mod.name} first` })),
                ...(system ? [{ value: SYSTEM, label: 'Outside the app' }] : []),
            ]);
            opener.set(outside ? SYSTEM : (chosen?.mod ?? AUTOMATIC));
            list.set(mods.map((entry, index) => ({ ...entry, index, outside })));
            none.hidden = mods.length > 0;
            defaultRow.set({
                position: outside ? '1' : NO_VALUE,
                label: defaultAnswer || 'Nothing opens it',
                muted: !outside,
            });
            defaultRow.element.title = defaultAnswer
                ? outside
                    ? `You chose this: every address of it opens outside ${appName}, offered to no mod.`
                    : `${appName}'s own answer, when every mod passes.`
                : `${appName} has no answer of its own here: when every mod passes, the address is not opened.`;
            refusal.textContent = refusals.get(scheme.scheme) || '';
            refusal.hidden = !refusal.textContent;
        }

        function modEntry(entry) {
            const patterns = ui.element('span', { className: 'settings-scheme-patterns' });
            const row = handlerRow({ ui, trailing: patterns });

            rowFills.set(row.element, fill);
            fill(entry);
            return row.element;

            function fill({ mod, patterns: written, index, outside }) {
                patterns.textContent = patterns.title = written.map(patternText).join(', ');
                row.set({ position: outside ? NO_VALUE : String(index + 1), label: mod.name, muted: outside });
                row.element.title = outside
                    ? `${mod.name} is offered none of these while they open outside ${appName}`
                    : index === 0
                      ? `${mod.name} is offered an address first, where its patterns take it`
                      : `${mod.name} is offered an address in this place, where its patterns take it`;
            }
        }
    }

    // `value` from a card's menu as the service takes a choice. The card is drawn as the service has it after, with
    // why when it refused.
    function choose(scheme, value) {
        refusals.delete(scheme);
        const choice = value === AUTOMATIC ? null : value === SYSTEM ? { system: true } : { mod: value };
        Promise.resolve()
            .then(() => {
                if (!urls()) throw new Error('The URLs mod is not running');
                return urls().choose(scheme, choice);
            })
            .catch((error) => refusals.set(scheme, error.message || String(error)))
            .then(onChange);
    }

    function schemeDescription(scheme) {
        if (scheme === '*') return 'An address whose scheme no mod names, for the mods that take every scheme.';
        if (scheme === 'http' || scheme === 'https')
            return 'A web address: a link clicked in a mod, or a page asking for a new window.';
        if (scheme === 'file') return 'A file on this Mac, such as a row in a file list.';
        return `An address that starts with ${scheme}:, which a mod named.`;
    }
}

module.exports = { urlSchemesSection };
