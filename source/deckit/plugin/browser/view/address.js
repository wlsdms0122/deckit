// What was typed or handed over as an address, or null when it is none. A file path may hold spaces, so it is read
// before whitespace means a search.
function parseAddress(given) {
    const text = String(given || '').trim();
    if (/^file:\/\//i.test(text)) return hrefOf(text);
    if (/^\/[^/]/.test(text)) return hrefOf('file://' + text.split('/').map(encodeURIComponent).join('/'));
    if (!text || /\s/.test(text)) return null;
    if (/^https?:\/\//i.test(text)) return hrefOf(text);
    if (/^(localhost|[\w-]+(\.[\w-]+)+|\d{1,3}(\.\d{1,3}){3})(:\d{1,5})?([/?#].*)?$/i.test(text))
        return hrefOf('https://' + text);
    return null;
}

// The one spelling of an address, so a tab and a bookmark of the same page compare equal.
function canonical(url) {
    return hrefOf(url) ?? url;
}

function hostOf(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}

function originOf(url) {
    try {
        return new URL(url).origin;
    } catch {
        return '';
    }
}

function isFile(url) {
    return /^file:/i.test(url);
}

function isWeb(url) {
    return /^https?:/.test(originOf(url));
}

// What names a page in a line: a file's name, or a site's host.
function placeOf(url) {
    if (!isFile(url)) return hostOf(url);
    try {
        return decodeURIComponent(new URL(url).pathname.split('/').pop() || '/');
    } catch {
        return url;
    }
}

// The icon of a tab or a bookmark. A page that names no icon usually has /favicon.ico; a file has none.
function faviconOf({ url, icon }) {
    if (icon) return icon;
    if (!/^https?:/i.test(url)) return '';
    return hrefOf('/favicon.ico', url) ?? '';
}

function hrefOf(url, base) {
    try {
        return new URL(url, base).href;
    } catch {
        return null;
    }
}
