module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const content = document.createElement('div');
        const field = document.createElement('textarea');
        field.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;margin:0;border:0;padding:0;resize:none';
        content.append(field);
        content.addEventListener('keydown', (event) => say('mod-b/keydown/' + event.code));
        shell.view.register({ content });
    }
};
