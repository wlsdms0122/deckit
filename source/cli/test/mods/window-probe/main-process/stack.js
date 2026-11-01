// What a main process module finds: whether the window the mod's page is shown in is found.
module.exports = ({ window }) => ({
    found: () => !!window.ofPage(),
});
