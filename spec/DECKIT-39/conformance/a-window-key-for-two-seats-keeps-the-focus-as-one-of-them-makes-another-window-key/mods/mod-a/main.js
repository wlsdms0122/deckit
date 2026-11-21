module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const open = (options) => {
            const content = document.createElement('div');
            const field = document.createElement('textarea');
            field.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;margin:0;border:0;padding:0;resize:none';
            content.append(field);
            for (const type of ['focus', 'blur']) field.addEventListener(type, () => say(options.name + '/' + type));
            shell.windows.open({ ...options, content, didBecomeKey: () => field.focus() });
        };
        for (const options of [{"name": "main", "activates": false}, {"name": "second", "activates": false}]) open(options);
    }
};
