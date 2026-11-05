const { chip } = require('../../chip/chip.js');
const { section } = require('../section/section.js');
const { handlerRow, moved, placing } = require('../handler-list/handler-list.js');

// The Interfaces section: a card per interface a mod implements or depends on, with its implementations in their
// order, reordered by dragging and switched off one by one. The first that is on is the one picked: the mods that
// depend on the interface get it. An order deckit refuses is told on its card, and the list is drawn as it stands.
// `mods` is deckit.mods.
function interfacesSection({ ui, mods }) {
    const TITLE = 'Interfaces';
    const KEYWORDS = ['인터페이스', '구현', '의존', 'interface', 'implementation', 'dependency'];
    const DESCRIPTION =
        'What mods offer each other, by name, and the mods that implement each. A mod that depends on one gets ' +
        'the first that is on; drag to change the order, switch one off to pass it over.';

    const cardFills = new WeakMap(); // card -> its fill(interfaceList)
    const rowFills = new WeakMap(); // implementation row -> its fill(entry)
    const refusals = new Map(); // interface -> why deckit refused the order last asked for it

    ui.addStyle(`
        .settings-interface-head { display: flex; align-items: center; gap: 8px; padding: 0 12px; }
        .settings-interface-name { flex: 1 1 auto; min-width: 0; font: 600 var(--deckit-type-body); }
        .settings-interface-description { padding: 1px 12px 6px; font: var(--deckit-type-small); opacity: 0.5; }
        .settings-interface-none { padding: 4px 12px 6px 44px; font: 12.5px var(--deckit-font); opacity: 0.4; }
        .settings-interface-version {
            flex: 0 0 auto;
            font: var(--deckit-type-small);
            font-variant-numeric: tabular-nums;
            opacity: 0.45;
        }
        .settings-interface-refusal {
            padding: 4px 12px 6px 44px;
            color: var(--deckit-alert);
            font: var(--deckit-type-small);
            white-space: pre-wrap;
        }
    `);
    const { element, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const cards = ui.list({
        key: (interfaceList) => interfaceList.interface,
        create: interfaceCard,
        update: (card, interfaceList) => cardFills.get(card)(interfaceList),
    });

    body.append(cards.element);
    return { element, title: TITLE, keywords: KEYWORDS, draw };

    function draw(interfaceLists) {
        cards.set(interfaceLists);
    }

    function interfaceCard(interfaceList) {
        let current = interfaceList;

        const card = ui.element('div', { className: 'settings-card' });
        const head = ui.element('div', { className: 'settings-interface-head' });
        const name = ui.element('div', { className: 'settings-interface-name', text: interfaceList.interface });
        const undecided = chip({ ui, text: 'Undecided' });
        const description = ui.element('div', { className: 'settings-interface-description' });
        const none = ui.element('div', { className: 'settings-interface-none', text: 'No mod implements it.' });
        const refusal = ui.element('div', { className: 'settings-interface-refusal' });
        const list = ui.list({
            key: ({ implementation }) => implementation.id,
            create: implementationEntry,
            update: (row, entry) => rowFills.get(row)(entry),
        });

        undecided.element.title =
            'No one placed its mods, so the first that is on is used for now. Drag one to the top.';
        head.append(name, undecided.element);
        card.append(head, description, none, list.element, refusal);
        ui.sortable(list, {
            onReorder: (id, toId) => {
                const next = moved(current.implementations, id, toId);
                if (next) save(current.interface, next.list, next);
            },
        });
        cardFills.set(card, fill);
        fill(interfaceList);
        return card;

        function fill(interfaceList) {
            current = interfaceList;
            const { implementations } = interfaceList;
            list.set(implementations.map((implementation, index) => ({ implementation, index })));
            none.hidden = implementations.length > 0;
            undecided.element.hidden = !interfaceList.undecided;
            description.textContent = interfaceList.name
                ? `Defined by ${interfaceList.name}.`
                : 'No mod found defines it.';
            refusal.textContent = refusals.get(interfaceList.interface) || '';
            refusal.hidden = !refusal.textContent;
        }

        function implementationEntry(entry) {
            let currentEntry = entry;

            const version = ui.element('span', { className: 'settings-interface-version' });
            const toggle = ui.toggle({
                value: entry.implementation.on,
                onChange: (on) => {
                    const { implementation } = currentEntry;
                    const next = current.implementations.map((candidate) =>
                        candidate.id === implementation.id ? { ...implementation, on } : candidate
                    );
                    toggle.set(on);
                    save(current.interface, next, placing(next, implementation.id));
                },
            });
            const row = handlerRow({ ui, trailing: [version, toggle.element], draggable: true });

            rowFills.set(row.element, fill);
            fill(entry);
            return row.element;

            function fill(entry) {
                currentEntry = entry;
                const { implementation, index } = entry;
                const picked = current.implementations.find((candidate) => candidate.on) === implementation;
                toggle.set(implementation.on);
                toggle.element.title = !implementation.on
                    ? `${implementation.name} is passed over`
                    : picked
                      ? `${implementation.name} is the one picked`
                      : `${implementation.name} is used when none before it is on`;
                version.textContent = implementation.version;
                row.set({ position: String(index + 1), label: implementation.name, muted: !implementation.on });
            }
        }
    }

    // `implementations` is drawn at once, and the list as deckit has it once it set `order` and `off`: a refused one is
    // drawn as it stands, with why.
    function save(named, implementations, { order, off }) {
        refusals.delete(named);
        draw(withList(named, implementations));
        mods.pin(named, order[0] ?? null).then(
            () => draw(mods.list().interfaces),
            (error) => {
                refusals.set(named, error.message || String(error));
                draw(mods.list().interfaces);
            }
        );
    }

    // The interfaces as deckit lists them, with `named` in the order given.
    function withList(named, implementations) {
        return mods
            .list()
            .interfaces.map((interfaceList) =>
                interfaceList.interface === named ? { ...interfaceList, implementations } : interfaceList
            );
    }
}

module.exports = { interfacesSection };
