// A provider's icon is another mod's text: drawn from its shapes alone.
function providerIcon(ui, svg, size = 14) {
    const holder = document.createElement('span');
    const icon = ui.sanitizeIcon(svg);
    icon.setAttribute('width', size);
    icon.setAttribute('height', size);
    holder.append(icon);
    Object.assign(holder.style, { display: 'flex', flex: '0 0 auto' });
    return holder;
}

module.exports = { providerIcon };
