const CALLBACKS = ['didAppear', 'didDisappear', 'didBecomeKey', 'didResignKey', 'didResize', 'didClose'];
const TOLD = 'main';
module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const held = new Map();
        const roomOf = (name) => {
            const room = held.get(name)?.room;
            return room ? room.width + 'x' + room.height : String(room);
        };
        const open = (options) => {
            const content = document.createElement('div');
            const told = {};
            if (options.name === TOLD) {
                for (const one of CALLBACKS) told[one] = () => say(options.name + '/' + one);
                told.didChangeRoom = () => say(options.name + '/didChangeRoom/' + roomOf(options.name));
            }
            held.set(options.name, shell.windows.open({ ...told, ...options, content }));
            if (options.name === TOLD) say(options.name + '/room/' + roomOf(options.name));
        };
        for (const options of [{"name": "main"}]) open(options);
        deckit.events.on('mod-a:go', (...commands) => {
            for (const command of commands) {
                if (command.open) open(command.open);
                else if (command.room) say(command.room + '/room/' + roomOf(command.room));
            }
        });
    }
};
