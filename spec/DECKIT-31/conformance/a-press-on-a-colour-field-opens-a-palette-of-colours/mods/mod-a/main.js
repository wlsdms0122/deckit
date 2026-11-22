module.exports = class {
    attach(shell, deckit) {
        const content = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'color';
        input.value = '#010203';
        input.setAttribute('aria-label', 'Colour');
        input.style.cssText = 'position:absolute;box-sizing:border-box;margin:0;left:20px;top:100px;width:200px;height:30px';
        content.append(input);
        shell.windows.open({ name: 'main', content });
    }
};
