// In menu order. `key` is also the keymap action that sets the style; `mark` starts a line in it.
const PARAGRAPH_STYLES = [
    { key: 'title', label: 'Title', mark: '# ' },
    { key: 'heading', label: 'Heading', mark: '## ' },
    { key: 'subheading', label: 'Subheading', mark: '### ' },
    { key: 'body', label: 'Body', mark: '' },
    { key: 'monospaced', label: 'Monospaced' },
    '-',
    { key: 'bulletedList', label: 'Bulleted List', mark: '- ' },
    { key: 'numberedList', label: 'Numbered List', mark: '1. ' },
    { key: 'checklist', label: 'Checklist', mark: '- [ ] ' },
    '-',
    { key: 'blockQuote', label: 'Block Quote', mark: '> ' },
];
