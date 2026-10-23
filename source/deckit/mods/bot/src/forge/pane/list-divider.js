const { styled } = require('../../dom/dom.js');

const listDivider = ({ ui, store, pane, list, key }) => {
    Object.assign(list.style, {
        width: Math.max(200, store.get(key, 300)) + 'px',
        minWidth: '200px',
        maxWidth: 'calc(100% - 320px)',
        flexShrink: '0',
        boxSizing: 'border-box',
    });
    const LINE_IDLE = `color-mix(in srgb, var(--deckit-text) 26%, var(--deckit-background))`;
    const LINE_HOT = `color-mix(in srgb, var(--deckit-text) 62%, var(--deckit-background))`;
    const divider = styled('div', { flex: '0 0 auto', width: '0', position: 'relative', zIndex: '1' });
    const hit = styled('div', {
        position: 'absolute',
        top: '0',
        bottom: '0',
        left: '-4px',
        width: '8px',
        cursor: 'col-resize',
    });
    const line = styled('div', {
        position: 'absolute',
        top: '0',
        bottom: '0',
        left: '-1px',
        width: '2px',
        background: LINE_IDLE,
        opacity: '0',
        transition:
            'opacity var(--deckit-fast) var(--deckit-easing), background-color var(--deckit-fast) var(--deckit-easing)',
    });
    hit.title = 'Drag to resize';
    divider.append(line, hit);
    let dragging = false;
    const paintLine = (on) => {
        line.style.opacity = on ? '1' : '0';
        line.style.background = dragging ? LINE_HOT : LINE_IDLE;
    };
    hit.addEventListener('mouseenter', () => paintLine(true));
    hit.addEventListener('mouseleave', () => {
        if (!dragging) paintLine(false);
    });
    ui.resizer(hit, {
        axis: 'x',
        size: () => list.getBoundingClientRect().width,
        min: 200,
        max: () => Math.max(200, pane.getBoundingClientRect().width - 320),
        onResize: (pixels) => {
            list.style.width = pixels + 'px';
        },
        onCommit: (pixels) => {
            list.style.width = pixels + 'px';
            store.set(key, Math.round(pixels));
        },
        onDrag: (on) => {
            dragging = on;
            paintLine(on || hit.matches(':hover'));
        },
    });
    return divider;
};
module.exports = { listDivider };
