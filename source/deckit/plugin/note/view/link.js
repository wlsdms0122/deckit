// A link in a note goes to a web address, or to another note by its path from the note it is in.
function isAddress(text) {
    return /^[a-z][a-z0-9+.-]*:/i.test(text);
}

// { address }, { note } (a path from the linking note), or null for a link that goes nowhere.
function linkTargetOf(href) {
    const written = String(href || '').trim();
    if (isAddress(written)) return { address: written };
    if (written.startsWith('/')) return null;
    let path;
    try {
        path = decodeURIComponent(written.replace(/^<|>$/g, ''));
    } catch {
        return null;
    }
    return /\.md$/i.test(path) ? { note: path } : null;
}

function linkedNotePath(from, target) {
    const parts = parentOf(from) ? parentOf(from).split('/') : [];
    for (const part of target.split('/')) {
        if (part === '..') parts.pop();
        else if (part && part !== '.') parts.push(part);
    }
    return parts.join('/');
}

// A parenthesis or a space would end a link destination early. A no-break space encodes as two bytes.
function linkDestinationOf(href) {
    return String(href)
        .replace(/[()]/g, (parenthesis) => (parenthesis === '(' ? '%28' : '%29'))
        .replace(/\s/g, encodeURIComponent);
}
