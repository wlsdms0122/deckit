// A mod with a view, which asks a main process module of its own what it finds of the window the panel is in, and
// installs the folder the test hands it as a person would, by a press in its page.
module.exports = {
    start(deck) {
        const marks = document.documentElement.dataset;
        const install = document.createElement('button');
        install.id = 'install';
        install.textContent = 'Install';
        const content = document.createElement('div');
        content.append(install);
        deck.view({ content });
        let from = '';
        document.addEventListener('test-install-from', ({ detail }) => (from = detail));
        install.addEventListener('click', () =>
            deck.mods.install(from).then(
                ({ id }) => (marks.installed = id),
                (error) => (marks.installed = 'failed: ' + error.message)
            )
        );
        document.addEventListener('test-stack', async () => {
            const probe = await deck.mainProcess('main-process/stack.js');
            marks.found = String(await probe.found());
            marks.stack = JSON.stringify(await probe.stack());
        });
    },
};
