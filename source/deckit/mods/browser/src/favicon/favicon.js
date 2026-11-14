const { hrefOf } = require('../address/address.js');

// The icon of a page ({ url, icon, loading }) in a 16px box: its favicon, or a globe where it has none or its favicon
// fails; while it loads, a 12px spinner once the load has taken the kit's wait.
function favicon({ ui, page }) {
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
    if (page.loading) {
        element.dataset.loading = '';
        element.append(ui.spinner({ size: 12, wait: true }).element);
        return { element };
    }
    const globe = () => {
        element.style.color = 'var(--deckit-muted)';
        element.innerHTML = ui.icon('globe', { size: 16 });
    };
    const source = faviconOf(page);
    if (!source) {
        globe();
        return { element };
    }
    const image = ui.element('img', {
        style: { width: '16px', height: '16px', objectFit: 'contain', borderRadius: '3px' },
    });
    image.src = source;
    image.alt = '';
    image.loading = 'lazy';
    image.draggable = false;
    image.addEventListener('error', globe);
    element.append(image);
    return { element };
}

// Whether `slot` already shows the spinner of a page still loading, so that it is kept and its wait not begun again.
function stillLoading(slot, page) {
    return page.loading && !!slot.querySelector(':scope > [data-loading]');
}

// The icon of a tab or a bookmark. A page that names no icon usually has /favicon.ico; a file has none.
function faviconOf({ url, icon }) {
    if (icon) return icon;
    if (!/^https?:/i.test(url)) return '';
    return hrefOf('/favicon.ico', url) ?? '';
}

module.exports = { favicon, faviconOf, stillLoading };
