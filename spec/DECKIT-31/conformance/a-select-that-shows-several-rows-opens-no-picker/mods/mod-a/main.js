module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const content = document.createElement('div');
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Days');
        select.style.cssText = 'position:absolute;box-sizing:border-box;margin:0;left:20px;top:200px;width:200px;height:120px';
        select.size = 4;
        for (const day of ['Mon', 'Tue', 'Wed', 'Thu']) select.append(new Option(day, day.toLowerCase()));
        content.append(select);
        for (const type of ['input', 'change']) content.addEventListener(type, (event) => say(type + '/' + event.target.value));
        shell.windows.open({ name: 'main', content });
    }
};
