// What Deckit adds to the switcher through its `setActions(actions)`: what its commands do, those with an arg
// searched inside the action. Each action's value is `{ action, ...args }`, run by `does[action](args)`; one that
// opens a search is the value its results add an arg to. `address`, `modsFor(query)` and `versions()` answer what is
// searched, and `appName` is the app's.
function switcher({ util, appName, address, modsFor, versions, does }) {
    return { list, search, run };

    function list() {
        return [
            {
                label: 'Open Address',
                keywords: ['url', 'scheme', 'open', '주소', '열기'],
                opens: true,
                value: { action: 'open-address' },
            },
            {
                label: 'Restart Mod',
                keywords: ['relaunch', 'reload', '재시작'],
                opens: true,
                value: { action: 'restart-mod' },
            },
            { label: 'Restart ' + appName, keywords: ['relaunch', '재시작'], value: { action: 'restart-app' } },
            { label: 'Show Mods Folder', keywords: ['finder', 'reveal'], value: { action: 'show-mods-folder' } },
            { label: 'Show Data Folder', keywords: ['finder', 'reveal'], value: { action: 'show-data-folder' } },
            { label: 'Show Log', keywords: ['finder', 'reveal', '로그'], value: { action: 'show-log' } },
            {
                label: 'About ' + appName,
                keywords: ['version', '버전', 'copy'],
                opens: true,
                value: { action: 'copy-version' },
            },
        ];
    }

    // Inside Open Address the address typed, inside Restart Mod the mods, inside About the versions to copy.
    function search(query, within) {
        if (within?.action === 'open-address')
            return address
                .candidatesFor(query)
                .map(({ value, title }) => ({ label: title, value: { ...within, address: value } }));
        if (within?.action === 'restart-mod')
            return modsFor(query).map(({ value, title, hint, keywords }) => ({
                label: title,
                hint,
                keywords,
                value: { ...within, mod: value },
            }));
        if (within?.action === 'copy-version')
            return versions()
                .filter((version) => !query || util.match(version, query))
                .map((version) => ({ label: version, hint: 'Copy', value: { ...within, version } }));
        return [];
    }

    async function run({ action, ...args }) {
        await does[action](args);
    }
}

module.exports = { switcher };
