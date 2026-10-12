// The rules of both chips. The page adopts them once.
const CHIP_STYLE = `
    .settings-chip {
        flex: 0 0 auto;
        padding: 1px 7px;
        border: var(--deckit-border);
        border-radius: var(--deckit-radius-round);
        font: 11.5px var(--deckit-font);
        opacity: 0.75;
    }
    .settings-chip[data-muted] { opacity: 0.45; }
    .settings-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 8px;
        border: var(--deckit-border);
        border-radius: var(--deckit-radius-round);
        white-space: nowrap;
    }
    .settings-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--deckit-alert); }
    .settings-status[data-ok] .settings-status-dot { background: var(--deckit-ok); }
`;

function chip({ ui, text, muted = false }) {
    const element = ui.element('span', { className: 'settings-chip', text });
    element.toggleAttribute('data-muted', muted);
    return { element };
}

// A chip with a dot that is green when `ok`, red otherwise.
function statusChip({ ui, text, ok }) {
    const element = ui.element('span', { className: 'settings-status' });
    element.toggleAttribute('data-ok', !!ok);
    element.append(ui.element('span', { className: 'settings-status-dot' }), ui.element('span', { text }));
    return { element };
}
