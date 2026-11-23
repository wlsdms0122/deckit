module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const content = document.createElement('div');
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Fruit');
        select.style.cssText = 'position:absolute;box-sizing:border-box;margin:0;left:20px;top:100px;width:200px;height:30px';
        select.append(new Option('Apple', 'apple', true, true), new Option('Pear', 'pear'));
        content.append(select);
        for (const type of ['input', 'change']) content.addEventListener(type, (event) => say(type + '/' + event.target.value));
        shell.windows.open({ name: 'main', content, titleBar: 'unified' });
    }
};
