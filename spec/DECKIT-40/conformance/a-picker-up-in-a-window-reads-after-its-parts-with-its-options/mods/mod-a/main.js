module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const content = document.createElement('div');
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Fruit');
        select.style.cssText = 'position:absolute;box-sizing:border-box;margin:0;left:20px;top:100px;width:200px;height:30px';
        const citrus = document.createElement('optgroup');
        citrus.label = 'Citrus';
        citrus.append(new Option('Orange', 'orange'), new Option('Lime', 'lime'));
        citrus.lastChild.disabled = true;
        select.append(new Option('Apple', 'apple', true, true), citrus, new Option('Pear', 'pear'));
        content.append(select);
        for (const type of ['input', 'change']) content.addEventListener(type, (event) => say(type + '/' + event.target.value));
        shell.windows.open({ name: 'main', content });
    }
};
