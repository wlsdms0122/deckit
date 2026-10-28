// What an empty cell shows.
const NO_VALUE = '–';

// What `deckit.mods.usage` found of a mod, in words: a phrase for each place it has something in, and the name of each
// thing the layers keep for it (`kept`), such as its configuration.
function usageParts({ data, records, kept = [] }) {
    return [
        data.count || data.hidden ? filesText(data, 'data file') : '',
        records.count || records.hidden ? filesText(records, 'record') : '',
        ...kept,
    ].filter(Boolean);
}

// `A, B and C`.
function listText(items) {
    return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0] || '';
}

function filesText({ count, capped = false, hidden }, noun) {
    if (count === 0 && hidden) return `hidden ${noun}s`;
    const nouns = count === 1 && !capped ? noun : noun + 's';
    return `${count}${capped ? '+' : ''} ${nouns}${hidden ? ' and hidden ones' : ''}`;
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
    for (const pattern of live.urls) labels.push('opens: ' + (pattern === everyScheme ? 'every address' : pattern));
    if (live.exports) labels.push('exports');
    for (const target of live.styles ?? []) labels.push('styles: ' + (target === '*' ? 'every page' : target));
    return labels;
}

function nameAndVersion(mod) {
    return `${mod.name} ${mod.version || ''}`.trim();
}

module.exports = { NO_VALUE, usageParts, listText, schemeName, ordinal, contributionsOf, nameAndVersion };
