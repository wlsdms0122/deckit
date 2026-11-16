// The probe of DECKIT-42's cases: it runs a command it declares by saying so, and opens a view under its item's
// anchor as the event <id>:go tells it, each callback said.
const CALLBACKS = ['didAppear', 'didDisappear', 'didClose'];
module.exports = class {
    start(deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        deckit.exports.register({ connect: () => ({ runCommand: (id) => say('mod-d/ran/' + id) }) });
    }
    attach(shell, deckit) {
        const id = 'mod-d';
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        deckit.events.on(id + ':go', (options = {}) => {
            const told = Object.fromEntries(CALLBACKS.map((one) => [one, () => say(id + '/view/' + one)]));
            try {
                shell.windows.open({
                    ...told,
                    name: 'view',
                    level: 'panel',
                    activates: false,
                    anchor: { mod: 'status-bar', id },
                    content: document.createElement('div'),
                    width: 320,
                    height: 200,
                    ...options,
                });
            } catch (error) {
                say(id + '/view/threw/' + error.kind);
            }
        });
    }
};
