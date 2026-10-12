// The URL Schemes section: a card per scheme with its handler list, the plugins asked in turn to open an address,
// reordered by dragging and switched off one by one, and the app's own answer after them.
function urlSchemesSection({ ui, host, appName }) {
    const DEFAULT_HANDLER = {
        browser: 'Opens in the system browser',
        file: "Opens in the system's app when you asked for it, otherwise shows it in Finder",
    };
    const everyScheme = host.urlSchemes.everyScheme;

    const view = section({
        ui,
        title: 'URL Schemes',
        description:
            'Addresses by their scheme, and the plugins that open them. Plugins are asked in order, ' +
            'and one may pass; drag to change the order, switch one off to skip it. When every plugin ' +
            `passes, ${appName} opens it the default way, for a scheme it has one for.`,
    });
    const cards = ui.list({ key: (handlerList) => handlerList.id, create: createCard });

    view.body.append(cards.element);
    return { element: view.element, title: view.title, draw };

    function draw() {
        cards.set(host.urlSchemes.list());
    }

    function createCard(handlerList) {
        const handlers = handlerList.handlers;
        const card = ui.element('div', { className: 'settings-card' });
        const list = ui.list();
        const defaultAnswer = DEFAULT_HANDLER[handlerList.system];

        card.append(
            ui.element('div', { className: 'settings-scheme-name', text: schemeName(handlerList.id, everyScheme) }),
            ui.element('div', { className: 'settings-scheme-when', text: schemeWhen(handlerList.id) })
        );
        ui.sortable(list.element, {
            onReorder: (from, to) => {
                const next = [...handlers];
                next.splice(to, 0, next.splice(from, 1)[0]);
                save(handlerList.id, next);
                draw();
            },
        });
        handlers.forEach((handler, index) => {
            const toggle = ui.toggle({
                value: handler.on,
                onChange: (on) => {
                    toggle.set(on);
                    save(
                        handlerList.id,
                        handlers.map((candidate) => (candidate === handler ? { ...handler, on } : candidate))
                    );
                    draw();
                },
            });
            toggle.element.title = handler.on
                ? `${handler.name} is asked ${index === 0 ? 'first' : 'in this place'}`
                : `${handler.name} is skipped`;
            list.element.append(
                handlerRow({
                    place: String(index + 1),
                    label: handler.name,
                    trailing: toggle.element,
                    muted: !handler.on,
                    draggable: true,
                })
            );
        });
        if (!handlers.length)
            card.append(ui.element('div', { className: 'settings-scheme-none', text: 'No plugin takes this over.' }));
        const defaultRow = defaultAnswer
            ? handlerRow({
                  place: NO_VALUE,
                  label: defaultAnswer,
                  trailing: chip({ ui, text: 'Default', muted: true }),
                  muted: true,
              })
            : handlerRow({ place: NO_VALUE, label: 'Nothing opens it', trailing: ui.element('span'), muted: true });
        defaultRow.title = defaultAnswer
            ? `${appName}'s own answer. It is always last and cannot be switched off.`
            : `${appName} has no answer of its own here: when every plugin passes, the address is not opened.`;
        card.append(list.element, defaultRow);
        return card;
    }

    function save(scheme, handlers) {
        host.urlSchemes.set(scheme, {
            order: handlers.map((handler) => handler.id),
            off: handlers.filter((handler) => !handler.on).map((handler) => handler.id),
        });
    }

    function handlerRow({ place, label, trailing, muted, draggable = false }) {
        const row = ui.element('div', { className: 'settings-handler' });
        const grip = ui.element('span', { className: 'settings-handler-grip' });
        const name = ui.element('span', { className: 'settings-handler-name', text: label });

        row.toggleAttribute('data-draggable', draggable);
        row.toggleAttribute('data-muted', muted);
        if (draggable) grip.innerHTML = ui.icon('grip', { size: 14 });
        name.title = label;
        row.append(grip, ui.element('span', { className: 'settings-handler-place', text: place }), name, trailing);
        return row;
    }

    function schemeWhen(id) {
        if (id === everyScheme) return 'An address no line above names, for the plugins that take every scheme.';
        if (id === 'http' || id === 'https')
            return 'A web address: a link clicked in a plugin, or a page asking for a new window.';
        if (id === 'file') return 'A file on this Mac, such as a row in a file list.';
        return `An address that starts with ${id}:, which a plugin named.`;
    }
}
