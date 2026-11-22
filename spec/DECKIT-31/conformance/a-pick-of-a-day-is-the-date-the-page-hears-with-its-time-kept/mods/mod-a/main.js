module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const content = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'datetime-local';
        input.value = '2026-03-14T09:30';
        input.setAttribute('aria-label', 'Day');
        input.style.cssText = 'position:absolute;box-sizing:border-box;margin:0;left:20px;top:100px;width:200px;height:30px';
        content.append(input);
        for (const type of ['input', 'change']) content.addEventListener(type, (event) => say(type + '/' + event.target.value));
        shell.windows.open({ name: 'main', content });
    }
};
