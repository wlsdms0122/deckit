const { nameOf } = require('../path/path.js');

const DISK_NOTICE_STYLE = `
    .editor-disk-notice {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 8px 14px 0;
        padding: 7px 8px 7px 10px;
        border-radius: 7px;
        border: var(--deckit-border);
        font: 12.5px var(--deckit-font);
        background: color-mix(in srgb, var(--deckit-warn) 10%, transparent);
    }
    .editor-disk-notice[hidden] { display: none; }
    .editor-disk-notice-text { flex: 1 1 auto; }
    .editor-disk-notice-actions { display: flex; gap: 6px; flex: 0 0 auto; }
`;

// What the open file's disk state asks of the person: it was deleted on disk, it can no longer be opened, or it changed
// on disk while it had unsaved changes here.
function diskNotice({ ui, onSaveAs, onClose, onReload, onKeepMine }) {
    let file = null;

    const element = ui.element('div', { className: 'editor-disk-notice' });
    const text = ui.element('div', { className: 'editor-disk-notice-text' });
    const actions = ui.element('div', { className: 'editor-disk-notice-actions' });
    const saveAs = buttonOf('Save As…', onSaveAs);
    const close = buttonOf('Close', onClose);
    const reload = buttonOf('Reload from disk', onReload);
    const keepMine = buttonOf('Keep mine', onKeepMine);

    element.hidden = true;
    element.append(text, actions);

    return { element, show };

    function show(next) {
        file = next;
        element.hidden = !file?.conflict && !file?.trouble;
        if (element.hidden) return actions.replaceChildren();
        const name = nameOf(file.path);
        if (file.trouble?.kind === 'GONE') {
            text.textContent = `${name} was deleted on disk. What is here is all there is of it.`;
            actions.replaceChildren(saveAs, close);
        } else if (file.trouble) {
            text.textContent = `${name} can no longer be opened here: ${file.trouble.message}`;
            actions.replaceChildren(close);
        } else {
            text.textContent = `${name} changed on disk while it had unsaved changes here.`;
            actions.replaceChildren(reload, keepMine);
        }
    }

    function buttonOf(label, act) {
        return ui.button({ label, size: 'small', onClick: () => act(file) }).element;
    }
}

module.exports = { DISK_NOTICE_STYLE, diskNotice };
