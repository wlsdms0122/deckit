// A path read off the screen (a row, a card, a menu, a drag) is marked with the count of relocations recorded when it
// was read, its `since`; the relocations recorded after that bring it up to date.
function relocationLog({ movePath, idle }) {
    const LIMIT = 100;
    const relocations = [];
    let recorded = 0;

    return { record, since: () => recorded, currentPath };

    // `to` null: the path went to the Trash. Each relocation keeps the count recorded before it.
    function record(from, to) {
        relocations.push({ from, to, since: recorded++ });
        if (relocations.length > LIMIT) relocations.shift();
    }

    // Null when the path went to the Trash since.
    async function currentPath(path, since) {
        await idle();
        return relocations.reduce(
            (current, relocation) =>
                relocation.since >= since ? movePath(current, relocation.from, relocation.to) : current,
            path
        );
    }
}

module.exports = { relocationLog };
