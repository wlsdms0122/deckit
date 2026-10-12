// The keyboard shortcuts, by keymap action.
function keyboardShortcuts({ editor, onNewNote, onNewFolder, onTrash, onSearch, onBack, onForward }) {
    return {
        newNote: { key: 'mod+n', label: 'New note', run: () => onNewNote() },
        newFolder: { key: 'mod+shift+n', label: 'New folder', run: () => onNewFolder() },
        // While a text field has focus, ⌘⌫ stays the field's (delete to line start).
        trash: { key: 'mod+backspace', label: 'Move to Trash', run: () => onTrash() },
        search: { key: 'mod+f', label: 'Search notes', run: () => onSearch() },
        back: { key: 'mod+[', label: 'Back', run: () => onBack() },
        forward: { key: 'mod+]', label: 'Forward', run: () => onForward() },
        title: { key: 'mod+shift+t', label: 'Title', run: whileWriting('title') },
        heading: { key: 'mod+shift+h', label: 'Heading', run: whileWriting('heading') },
        subheading: { key: 'mod+shift+j', label: 'Subheading', run: whileWriting('subheading') },
        body: { key: 'mod+shift+b', label: 'Body', run: whileWriting('body') },
        monospaced: { key: 'mod+shift+m', label: 'Monospaced', run: whileWriting('monospaced') },
        bulletedList: { key: 'mod+shift+7', label: 'Bulleted list', run: whileWriting('bulletedList') },
        numberedList: { key: 'mod+shift+9', label: 'Numbered list', run: whileWriting('numberedList') },
        checklist: { key: 'mod+shift+l', label: 'Checklist', run: whileWriting('checklist') },
        markChecked: {
            key: 'mod+shift+u',
            label: 'Mark as checked',
            run: () => {
                if (editor.hasFocus()) editor.toggleChecked();
            },
        },
        blockQuote: { key: "mod+'", label: 'Block quote', run: whileWriting('blockQuote') },
    };

    // Only while the note has the keyboard: elsewhere a text key would change a line nobody is looking at.
    function whileWriting(style) {
        return () => {
            if (editor.hasFocus()) editor.setParagraphStyle(style);
        };
    }
}

module.exports = { keyboardShortcuts };
