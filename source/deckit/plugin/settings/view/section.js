// A titled part of the page. The owner adds to `head`, after the title, and fills `body`.
function section({ ui, title, description = '' }) {
    const element = ui.element('div', { className: 'settings-section' });
    const head = ui.element('div', { className: 'settings-section-head' });
    const body = ui.element('div');

    head.append(ui.element('div', { className: 'settings-section-title', text: title }));
    element.append(head);
    if (description)
        element.append(ui.element('div', { className: 'settings-section-description', text: description }));
    element.append(body);
    return { element, head, body, title };
}
