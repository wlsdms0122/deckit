const workflowTree = (catalog, { query = '', folded = [] } = {}) => {
const root = { folders: new Map(), items: [], count: 0 };
const match = query.trim().toLowerCase();
for (const item of catalog) {
if (!`${item.name} ${item.description || ''} ${item.source || ''}`.toLowerCase().includes(match)) continue;
let node = root; node.count++;
for (const folder of (item.source || '').split('/').slice(0, -1)) {
if (!node.folders.has(folder)) node.folders.set(folder, { folders: new Map(), items: [], count: 0 });
node = node.folders.get(folder); node.count++;
}
node.items.push(item);
}
const rows = [], closed = new Set(folded);
const walk = (node, path, depth) => {
for (const item of node.items.sort((a, b) => a.name.localeCompare(b.name))) rows.push({ key: 'workflow:' + item.name, item, depth });
for (const [name, child] of [...node.folders].sort(([a], [b]) => a.localeCompare(b))) {
const here = path ? path + '/' + name : name, open = !!match || !closed.has(here);
rows.push({ key: 'folder:' + here, folder: here, name, depth, open, count: child.count });
if (open) walk(child, here, depth + 1);
}
};
walk(root, '', 0);
return rows;
};
const scheduleTree = (schedules, options) => workflowTree(schedules.map((item) => ({
name: item.id, description: item.workflow, source: item.source, schedule: item,
})), options).map((row) => row.folder ? row : { ...row, key: 'schedule:' + row.item.name, item: row.item.schedule });
module.exports = { workflowTree, scheduleTree };
