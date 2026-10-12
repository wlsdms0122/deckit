function chip({ ui, text, muted = false }) {
    const element = ui.element('span', { className: 'settings-chip', text });
    element.toggleAttribute('data-muted', muted);
    return element;
}
