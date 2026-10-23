const { formatKind } = require('../view/format.js');

function isVisible(entry, showHidden) {
    return showHidden || !entry.hidden;
}

// What a folder shows: its entries the filter keeps, sorted by `order` ({ key, up }), ties by name.
function visibleEntries(entries, { showHidden, filter, order, foldersFirst }) {
    const direction = order.up ? 1 : -1;
    return entries
        .filter((entry) => isVisible(entry, showHidden))
        .filter((entry) => !filter || entry.name.toLowerCase().includes(filter))
        .sort((left, right) => {
            if (foldersFirst && isFolder(left) !== isFolder(right)) return isFolder(left) ? -1 : 1;
            if (order.key === 'name') return direction * compareNames(left, right);
            const leftValue = sortValueOf(left, order.key);
            const rightValue = sortValueOf(right, order.key);
            const compared =
                typeof leftValue === 'string' ? leftValue.localeCompare(rightValue) : leftValue - rightValue;
            return direction * compared || compareNames(left, right);
        });
}

function nextSortOrder(order, key) {
    if (order.key === key) return { key, up: !order.up };
    return { key, up: key === 'name' || key === 'kind' };
}

function isFolder(entry) {
    return entry.kind === 'folder';
}

function compareNames(left, right) {
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
}

function sortValueOf(entry, key) {
    if (key === 'mtime') return entry.mtime;
    if (key === 'size') return entry.size ?? -1;
    return formatKind(entry);
}

module.exports = { isVisible, visibleEntries, nextSortOrder };
