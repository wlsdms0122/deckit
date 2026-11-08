// A mod with a window, which asks a main process module of its own whether it finds the window its page is shown in,
// installs the folder the test hands it as a person would, by a press in its window, opens the mods the test names as a
// person opens one the Dock does not keep, and takes files dropped on it. It is a system mod, which the test ships
// with the app: it opens the switcher by its command and binds another mod's key again through the system's services.
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
        this.open = () => shell.windows.open({ name: 'probe', content });
        this.open();
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
        document.addEventListener('test-load', ({ detail: ids }) =>
            Promise.all(ids.map((id) => deckit.mods.launch(id))).then(
                () => (marks.loaded = ids.join()),
                (error) => (marks.loaded = 'failed: ' + error.message)
            )
        );
        let commands = null;
        let keys = null;
        deckit.dependencies.onConnect('deckit/commands', (connected) => {
            commands = connected;
            return () => (commands = null);
        });
        deckit.dependencies.onConnect('deckit/keys', (connected) => {
            keys = connected;
            return () => (keys = null);
        });
        document.addEventListener('test-switcher', () => commands?.run('switcher', 'show'));
        document.addEventListener('test-bind', ({ detail: { mod, command, keystroke } }) =>
            keys?.set(mod, command, keystroke).then(
                ({ chord }) => (marks.bound = chord),
                (error) => (marks.bound = 'failed: ' + error.message)
            )
        );
        document.addEventListener('test-stack', async () => {
            const probe = await deckit.mainProcess('main-process/stack.js');
            marks.found = String(await probe.found());
        });
    }

    reopen() {
        this.open?.();
    }

    detach() {
        this.open = null;
    }
}

module.exports = WindowProbe;
