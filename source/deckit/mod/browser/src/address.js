// A host written without its scheme: this machine or an IP address, served over http as a browser reads them, and a
// name whose last label starts with a letter, over https. "1.5" is a number, not a host.
const LOCAL_HOST = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d{1,5})?([/?#].*)?$/i;
const NAMED_HOST = /^[\w-]+(\.[\w-]+)*\.[a-z][a-z0-9-]*(:\d{1,5})?([/?#].*)?$/i;

// What was typed or handed over as an address, or null when it is none. A file path may hold spaces, so it is read
// before whitespace means a search.
function parseAddress(given) {
    const text = String(given || '').trim();
    if (/^file:\/\//i.test(text)) return hrefOf(text);
    if (/^\/[^/]/.test(text)) return hrefOf('file://' + text.split('/').map(encodeURIComponent).join('/'));
    if (!text || /\s/.test(text)) return null;
    if (/^https?:\/\//i.test(text)) return hrefOf(text);
    if (LOCAL_HOST.test(text)) return hrefOf('http://' + text);
    if (NAMED_HOST.test(text)) return hrefOf('https://' + text);
    return null;
}

// Whether text is an address as written, with its scheme or as a path, rather than a host guessed from a bare name.
function isWrittenAddress(given) {
    const text = String(given || '').trim();
    return /^(https?|file):\/\//i.test(text) || /^\/[^/]/.test(text);
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

function hrefOf(url, base) {
    try {
        return new URL(url, base).href;
    } catch {
        return null;
    }
}

module.exports = { parseAddress, isWrittenAddress, canonical, hostOf, originOf, isFile, isWeb, placeOf, hrefOf };
