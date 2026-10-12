// What an empty cell shows.
const NO_VALUE = '–';

// What `host.plugins.count` found in a plugin's data folder, in words.
function storedFilesText({ count, capped, hidden }) {
    if (count === 0 && hidden) return 'hidden files';
    const files = count === 1 && !capped ? 'file' : 'files';
    return `${count}${capped ? '+' : ''} ${files}${hidden ? ' and hidden ones' : ''}`;
}

function schemeName(scheme, everyScheme) {
    return scheme === everyScheme ? 'Every other scheme' : scheme + ':';
}

// `index` counts from 0.
function ordinal(index) {
    return ['1st', '2nd', '3rd'][index] || `${index + 1}th`;
}

// The chips of the Contributes column.
function contributionsOf(live, keyCount, everyScheme) {
    if (!live) return [];
    const labels = [];
    if (live.view) labels.push('view');
    if (live.sidebar) labels.push('sidebar');
    if (live.commands) labels.push('commands');
    if (keyCount) labels.push(keyCount + (keyCount === 1 ? ' key' : ' keys'));
    if (live.now) labels.push('now');
    if (live.resolver) labels.push('resolver');
    for (const scheme of live.urlSchemes)
        labels.push('opens: ' + (scheme === everyScheme ? 'every scheme' : scheme + ':'));
    if (live.exports) labels.push('exports');
    return labels;
}

function nameAndVersion(plugin) {
    return `${plugin.name} ${plugin.version || ''}`.trim();
}
