module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const open = (options) => {
            const content = document.createElement('div');
            const field = document.createElement('textarea');
            field.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;margin:0;border:0;padding:0;resize:none';
            content.append(field);
            const hear = (type, said) => content.addEventListener(type, (event) => { const what = said(event); if (typeof what === 'string') say(options.name + '/' + type + '/' + what); });
            const held = (event) => ['alt', 'control', 'meta', 'shift'].filter((one) => event[one + 'Key']).join('+');
            for (const type of ['mousedown', 'mouseup']) hear(type, (event) => event.button + '/' + event.detail + '/' + held(event));
            hear('mousemove', (event) => String(event.buttons));
            hear('wheel', (event) => event.deltaX + '/' + event.deltaY);
            for (const type of ['keydown', 'keyup']) hear(type, (event) => event.code + '/' + event.key + '/' + held(event) + '/' + event.repeat);
            for (const type of ['compositionstart', 'compositionupdate']) hear(type, (event) => event.data);
            hear('compositionend', (event) => event.data + '/' + field.value);
            hear('input', (event) => event.inputType === 'insertText' && say(options.name + '/inserted/' + event.data));
            shell.windows.open({ ...options, content });
        };
        for (const options of []) open(options);
        deckit.events.on('mod-b:go', (options) => open(options));
    }
};
