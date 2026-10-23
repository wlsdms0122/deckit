const { hrefOf } = require('../address/address.js');

// The icon of a page ({ url, icon, loading }) in a line: a spinner while it loads, else its favicon in a 16px box.
function favicon({ ui, page }) {
    if (page.loading) return ui.spinner({ size: 13 });
    const element = ui.element('span', {
        style: {
            flex: '0 0 auto',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        },
    });
    const source = faviconOf(page);
    if (!source) return { element };
    const image = ui.element('img', {
        style: { width: '16px', height: '16px', objectFit: 'contain', borderRadius: '3px' },
    });
    image.src = source;
    image.alt = '';
    image.loading = 'lazy';
    image.draggable = false;
    image.addEventListener('error', () => image.remove());
    element.append(image);
    return { element };
}

// The icon of a tab or a bookmark. A page that names no icon usually has /favicon.ico; a file has none.
function faviconOf({ url, icon }) {
    if (icon) return icon;
    if (!/^https?:/i.test(url)) return '';
    return hrefOf('/favicon.ico', url) ?? '';
}

module.exports = { favicon };
