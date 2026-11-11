const CALLBACKS = ['didAppear', 'didDisappear', 'didBecomeKey', 'didResignKey', 'didResize', 'didClose'];
module.exports = class {
    attach(shell, deckit, frameworks) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        this.say = say;
        const held = new Map();
        const open = (options) => {
            const content = document.createElement('div');
            const told = {};
            if (false) for (const one of CALLBACKS) told[one] = () => say(options.name + '/' + one);
            try {
                const window = shell.windows.open({ ...told, ...options, content });
                held.set(options.name, Object.assign(Object.create(window), { content }));
            } catch (error) {
                say(options.name + '/threw/' + error.kind);
            }
        };
        this.open = open;
        for (const options of [{"name": "main"}, {"name": "f", "level": "overlay", "width": 200, "height": 100}]) open(options);
        deckit.events.on('mod-a:go', (...commands) => {
            for (const command of commands) {
                if (command.open) open(command.open);
                else if (command.list) say('list/' + shell.windows.list().map((one) => one.name).join(','));
                else if (command.take) {
                    const as = command.as ?? 'k';
                    shell.keys.take(command.take, () => say('chord/' + as), ...(command.scope === undefined ? [] : [{ scope: command.scope }]))
                        .then((taken) => { held.set('chord:' + as, taken); say('take/' + as + '/held/' + taken.held); })
                        .catch((error) => say('take/' + as + '/threw/' + error.kind + (globalThis.WHY ? '/' + encodeURIComponent(error.message) : '')));
                } else if (command.release) held.get('chord:' + command.release)?.release();
                else if (command.record) {
                    try {
                        held.set('record', shell.keys.record(command.record !== true ? command.record : (k) => say('rec/' + k.code + '/' + ['meta', 'control', 'alt', 'shift'].filter((m) => k[m]).join('+'))));
                    } catch (error) {
                        say('record/threw/' + error.kind);
                    }
                } else if (command.stop) held.get('record')?.();
                else if (command.guide) {
                    const root = held.get(command.guide).content?.ownerDocument?.documentElement;
                    say(command.guide + '/guide/' + String(root?.hasAttribute('data-deckit-title-bar')) + '/' + root?.style.getPropertyValue('--deckit-title-bar-area-height') + '/' + root?.style.getPropertyValue('--deckit-title-bar-area-x'));
                } else if (command.web) {
                    try {
                        const page = shell.web.window({ session: frameworks.web.session('main'), ...command.web });
                        page.delegate = { didClose: () => say('web/didClose') };
                        held.set('web', page);
                    } catch (error) {
                        say('web/threw/' + error.kind);
                    }
                }
                else if (command.do) {
                    try {
                        const window = held.get(command.name);
                        const value = window[command.do];
                        if (typeof value === 'function') value(...(command.args ?? []));
                        else say(command.name + '/' + command.do + '/' + value);
                    } catch (error) {
                        say(command.name + '/threw/' + error.kind);
                    }
                }
            }
        });
    }
};
