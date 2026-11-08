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

// A scheme as `deckit/urls` lists it, as a person reads it: `*` is the list of an address whose scheme no mod names.
function schemeName(scheme) {
    return scheme === '*' ? 'Every other scheme' : scheme + ':';
}

// A pattern of `deckit/urls` as a person reads it: `*` every address, `<scheme>:*` every one of the scheme.
function patternText(pattern) {
    if (pattern === '*') return 'every address';
    return /^[^:]+:\*$/.test(pattern) ? pattern.slice(0, -1) : pattern;
}

// `index` counts from 0.
function ordinal(index) {
    return ['1st', '2nd', '3rd'][index] || `${index + 1}th`;
}

// The chips of the Contributes column: what a mod as `deckit.mods.list()` finds it declares, and while it runs,
// `live` as it lists it running, the styles it lays on pages.
function contributionsOf({ contributes = {}, fields = {}, provides = {}, background }, live) {
    const labels = [];
    const count = (named, one, many) => {
        const entries = contributes[named]?.length ?? 0;
        if (entries) labels.push(`${entries} ${entries === 1 ? one : many}`);
    };
    if (fields.view) labels.push('view');
    if (background) labels.push('background');
    count('deckit/commands', 'command', 'commands');
    count('deckit/keys', 'key', 'keys');
    count('deckit/configuration', 'setting', 'settings');
    for (const { scheme, patterns } of contributes['deckit/urls'] ?? [])
        for (const pattern of patterns ?? [scheme === '*' ? '*' : `${scheme}:*`])
            labels.push('opens: ' + patternText(pattern));
    for (const named of Object.keys(provides)) labels.push('provides: ' + named);
    for (const target of live?.styles ?? []) labels.push('styles: ' + (target === '*' ? 'every page' : target));
    return labels;
}

function nameAndVersion(mod) {
    return `${mod.name} ${mod.version || ''}`.trim();
}

module.exports = { NO_VALUE, usageParts, listText, schemeName, patternText, ordinal, contributionsOf, nameAndVersion };
