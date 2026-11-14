// An address typed with its scheme, handed to `open`: the mods that open it, the one the person chose first, then
// outside the app.
function openAddress({ open }) {
    const ADDRESS = /^[a-z][a-z0-9+.-]*:\S+$/i;

    return { candidatesFor, go };

    // The address `partial` is, as the value of a command's arg, or none for text that is not one.
    function candidatesFor(partial) {
        const address = partial.trim();
        if (!ADDRESS.test(address)) return [];
        return [{ value: address, title: 'Open ' + address, hint: '', keywords: [] }];
    }

    async function go(given) {
        const address = String(given).trim();
        if (!ADDRESS.test(address)) throw new Error('An address needs its scheme: https://…, file:///…');
        await open(address);
    }
}

module.exports = { openAddress };
