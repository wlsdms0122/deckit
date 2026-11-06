const { chip } = require('../../chip/chip.js');
const { section } = require('../section/section.js');
const { handlerRow } = require('../handler-list/handler-list.js');

// The Interfaces section: a card per interface a mod provides or uses, with its owner and the mods that provide it in
// their queue, the earliest first. The owner is the provider the person pinned, or else the first in the queue; the
// card's menu pins one that can be pinned, or clears the pin. A provider kept in the queue and not found has no name
// and goes by its id. A pin deckit refuses is told on its card. `mods` is deckit.mods.
function interfacesSection({ ui, mods }) {
    const TITLE = 'Interfaces';
    const KEYWORDS = ['인터페이스', '주인', '고정', 'interface', 'owner', 'provider', 'pin'];
    const DESCRIPTION =
        'What mods offer each other, by name, and the mods that provide each. The mods that use one reach its ' +
        'owner: the first mod that provided it, unless you pin another.';
    const AUTOMATIC = null;

    const cardFills = new WeakMap(); // card -> its fill(interfaceQueue)
    const rowFills = new WeakMap(); // provider row -> its fill(entry)
    const refusals = new Map(); // interface -> why deckit refused the pin last asked for it

    ui.addStyle(`
        .settings-interface-head { display: flex; align-items: center; gap: 8px; padding: 0 12px; }
        .settings-interface-name { flex: 1 1 auto; min-width: 0; font: 600 var(--deckit-type-body); }
        .settings-interface-description { padding: 1px 12px 6px; font: var(--deckit-type-small); opacity: 0.5; }
        .settings-interface-none { padding: 4px 12px 6px 44px; font: 12.5px var(--deckit-font); opacity: 0.4; }
        .settings-interface-majors {
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
        key: (interfaceQueue) => interfaceQueue.interface,
        create: interfaceCard,
        update: (card, interfaceQueue) => cardFills.get(card)(interfaceQueue),
    });

    body.append(cards.element);
    return { element, title: TITLE, keywords: KEYWORDS, draw };

    function draw(interfaceQueues) {
        cards.set(interfaceQueues);
    }

    function interfaceCard(interfaceQueue) {
        let current = interfaceQueue;

        const card = ui.element('div', { className: 'settings-card' });
        const head = ui.element('div', { className: 'settings-interface-head' });
        const name = ui.element('div', { className: 'settings-interface-name', text: interfaceQueue.interface });
        const owner = ui.select({
            options: [],
            value: AUTOMATIC,
            onChange: (id) => {
                owner.set(id);
                pin(current.interface, id);
            },
        });
        const description = ui.element('div', { className: 'settings-interface-description' });
        const none = ui.element('div', { className: 'settings-interface-none', text: 'No mod provides it.' });
        const refusal = ui.element('div', { className: 'settings-interface-refusal' });
        const list = ui.list({
            key: ({ provider }) => provider.id,
            create: providerEntry,
            update: (row, entry) => rowFills.get(row)(entry),
        });

        head.append(name, owner.element);
        card.append(head, description, none, list.element, refusal);
        cardFills.set(card, fill);
        fill(interfaceQueue);
        return card;

        function fill(interfaceQueue) {
            current = interfaceQueue;
            const { providers } = interfaceQueue;
            const first = providers[0];
            // A provider kept with a problem is offered only while it holds the pin.
            const offered = providers.filter(
                (provider) => provider.pinnable || (interfaceQueue.pinned && provider.id === interfaceQueue.owner)
            );
            owner.setOptions([
                { value: AUTOMATIC, label: first ? `Automatic: ${named(first)}` : 'Automatic' },
                ...offered.map((provider) => ({ value: provider.id, label: `Pinned: ${named(provider)}` })),
            ]);
            owner.set(interfaceQueue.pinned ? interfaceQueue.owner : AUTOMATIC);
            owner.element.hidden = !providers.length;
            list.set(providers.map((provider, index) => ({ provider, index })));
            none.hidden = providers.length > 0;
            description.textContent = interfaceQueue.name
                ? `Defined by ${interfaceQueue.name}.`
                : 'No mod found defines it.';
            refusal.textContent = refusals.get(interfaceQueue.interface) || '';
            refusal.hidden = !refusal.textContent;
        }

        function providerEntry(entry) {
            const majors = ui.element('span', { className: 'settings-interface-majors' });
            const ownerChip = chip({ ui, text: 'Owner' });
            const row = handlerRow({ ui, trailing: [majors, ownerChip.element] });

            rowFills.set(row.element, fill);
            fill(entry);
            return row.element;

            function fill({ provider, index }) {
                const owns = provider.id === current.owner;
                const found = provider.name != null;
                majors.textContent = provider.majors.map((major) => `v${major}`).join(', ');
                majors.title = found ? `${provider.name} speaks major ${provider.majors.join(', ')} of it` : '';
                ownerChip.element.hidden = !owns;
                row.set({ position: String(index + 1), label: named(provider), muted: !owns || !found });
                row.element.title = !found
                    ? `${provider.id} is not found and keeps its place in line` +
                      (owns ? ': the mods that use it reach no one by it' : '')
                    : owns
                      ? `${provider.name} owns it: the mods that use it reach ${provider.name}`
                      : `${provider.name} provides it and waits in line: no one reaches it by this name`;
            }
        }
    }

    function named(provider) {
        return provider.name ?? `${provider.id} (not found)`;
    }

    // `id` pins that provider, AUTOMATIC clears the pin. The card is drawn as deckit has it after, with why when
    // deckit refused.
    function pin(named, id) {
        refusals.delete(named);
        mods.pin(named, id).then(
            () => draw(mods.list().interfaces),
            (error) => {
                refusals.set(named, error.message || String(error));
                draw(mods.list().interfaces);
            }
        );
    }
}

module.exports = { interfacesSection };
