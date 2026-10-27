// An address typed with its scheme, handed to deckit to open: its scheme's handlers in the person's order, then the
// system's answer.
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
