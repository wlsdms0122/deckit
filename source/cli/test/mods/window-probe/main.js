// A mod with a view, which asks a main process module of its own whether it finds the window its page is shown in,
// installs the folder the test hands it as a person would, by a press in its page, and takes files dropped on it.
class WindowProbe {
    attach(shell, deckit) {
        const marks = document.documentElement.dataset;
        const install = document.createElement('button');
        install.id = 'install';
        install.textContent = 'Install';
        const drop = document.createElement('div');
        drop.id = 'drop';
        Object.assign(drop.style, { width: '200px', height: '120px' });
        const content = document.createElement('div');
        content.append(install, drop);
        shell.view.register({ content });
        shell.dropDestination(drop, {
            onDrop: (paths, at) => (marks.dropped = JSON.stringify({ paths, at })),
            onTargeted: (on) => (marks.targeted = (marks.targeted || '') + (on ? 'on ' : 'off ')),
        });
        let from = '';
        document.addEventListener('test-install-from', ({ detail }) => (from = detail));
        install.addEventListener('click', () =>
            deckit.mods.install(from).then(
                ({ id }) => (marks.installed = id),
                (error) => (marks.installed = 'failed: ' + error.message)
            )
        );
        document.addEventListener('test-stack', async () => {
            const probe = await deckit.mainProcess('main-process/stack.js');
            marks.found = String(await probe.found());
        });
    }
}

module.exports = WindowProbe;
