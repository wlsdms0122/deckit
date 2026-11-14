// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What a window showing a web page is titled: the page's title, with the site it is on when the address is a web
// site's and the title is not the site itself, or the site alone while the page has no title.
function labelOf(title, url) {
    let site = '';
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') site = parsed.host;
    } catch {}
    if (!site || title === site) return title;
    return title ? `${title} (${site})` : site;
}

// MARK: - Private

export { labelOf };
