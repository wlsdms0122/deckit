module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const content = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'color';
        input.value = '#010203';
        input.setAttribute('aria-label', 'Colour');
        input.style.cssText = 'position:absolute;box-sizing:border-box;margin:0;left:20px;top:100px;width:200px;height:30px';
        content.append(input);
        for (const type of ['input', 'change']) {
            content.addEventListener(type, (event) => say(type + '/' + encodeURIComponent(event.target.value)));
        }
        shell.windows.open({ name: 'main', content });
    }
};
