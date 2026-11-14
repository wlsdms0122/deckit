module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const held = new Map();
        let content = null;
        let window = null;
        const open = () => {
            content = document.createElement('div');
            window = shell.windows.open({ name: 'main', content, ...{} });
        };
        open();
        const place = (element, box) => Object.assign(element.style, { position: 'fixed', left: box.x + 'px', top: box.y + 'px', width: box.width + 'px', height: box.height + 'px' });
        const tried = (what, n, act) => {
            try {
                const came = act();
                if (came && typeof came.then === 'function') came.catch((error) => say(what + '/' + n + '/threw/' + error.kind));
                return came;
            } catch (error) {
                say(what + '/' + n + '/threw/' + error.kind);
            }
        };
        const run = (command) => {
            if ('region' in command) {
                const element = document.createElement('div');
                place(element, command.box);
                if (command.clip) {
                    const box = document.createElement('div');
                    place(box, command.clip);
                    box.style.overflow = 'hidden';
                    content.append(box);
                    element.style.position = 'absolute';
                    box.append(element);
                } else content.append(element);
                const region = tried('region', command.region, () => shell.region(command.element === false ? null : element, command.interface));
                held.set('r' + command.region, { region, element });
            } else if ('place' in command) tried('place', command.place, () => held.get('r' + command.place).region.place(command.id));
            else if ('clear' in command) tried('clear', command.clear, () => held.get('r' + command.clear).region.clear());
            else if ('remove' in command) held.get('r' + command.remove).element.remove();
            else if ('hide' in command) held.get('r' + command.hide).element.style.display = 'none';
            else if ('show' in command) held.get('r' + command.show).element.style.display = '';
            else if ('move' in command) place(held.get('r' + command.move).element, command.box);
            else if ('drop' in command) {
                const element = document.createElement('div');
                place(element, command.box);
                (command.in ? held.get('d' + command.in).element : content).append(element);
                const name = command.drop;
                const options = command.options ?? {
                    ...command.extra,
                    onDrop: (paths, at) => deckit.events.emit('dropped', name, paths, at),
                    onTargeted: (on) => deckit.events.emit('targeted', name, on),
                };
                const off = tried('drop', name, () => shell.dropDestination(command.element === false ? null : element, options));
                held.set('d' + name, { off, element });
            } else if ('off' in command) held.get('d' + command.off).off();
            else if ('probe' in command) { const e = held.get('r' + command.probe).element; const b = e.getBoundingClientRect(); say('probe/' + [e.isConnected, e.ownerDocument === document, e.checkVisibility({ opacityProperty: true, visibilityProperty: true }), b.x, b.y, b.width, b.height, e.ownerDocument.defaultView.innerWidth].join(',')); }
            else if ('close' in command) window.close();
            else if ('open' in command) open();
        };
        for (const command of []) run(command);
        deckit.events.on('mod-c:go', (...commands) => commands.forEach(run));
    }
};
