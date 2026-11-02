// The Browser's downloads (`deckit.web.downloads`): a button at the toolbar's end, there once anything was downloaded,
// that opens them newest first. A row is a file and how far it got, and a press on a finished one opens it in its
// app. Its action stops one under way, shows a finished one in Finder, or forgets one that did not finish; Clear
// forgets every one that ended. The button bounces as a download starts.
function downloadList({ theme, ui, downloads }) {
    const ICON_SIZE = 16;
    const MAX_ROWS = 8;
    const UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB'];

    let items = [];

    ui.addStyle(`
        .browser-downloads-button[hidden] { display: none; }
        .browser-downloads-button[data-active] { color: var(--deckit-accent); }
        .browser-downloads { display: flex; flex-direction: column; gap: 6px; width: 320px; }
        .browser-downloads-heading { display: flex; align-items: center; justify-content: space-between; }
        .browser-downloads-title { font: var(--deckit-type-heading); }
        .browser-download { min-height: 44px; }
        .browser-download-text { display: flex; flex: 1 1 auto; flex-direction: column; gap: 2px; min-width: 0; }
        .browser-download-name { overflow: hidden; text-overflow: ellipsis; }
        .browser-download-status { color: var(--deckit-muted); font: var(--deckit-type-small); }
        .browser-download[data-state='failed'] .browser-download-status { color: var(--deckit-alert); }
        .browser-download-bar { height: 3px; border-radius: 2px; background: var(--deckit-fill); overflow: hidden; }
        .browser-download-bar > div { height: 100%; background: var(--deckit-accent); }
        .browser-download:not([data-state='downloading']) .browser-download-bar { display: none; }
    `);
    const button = ui.iconButton({
        icon: ui.icon('download', { size: ICON_SIZE }),
        title: 'Downloads',
        onClick: toggle,
    });
    button.element.classList.add('browser-downloads-button');
    const popover = ui.popover({ width: '360px' });
    const body = ui.element('div', { className: 'browser-downloads' });
    const heading = ui.element('div', { className: 'browser-downloads-heading' });
    const title = ui.element('div', { className: 'browser-downloads-title' });
    title.textContent = 'Downloads';
    const clear = ui.button({ label: 'Clear', size: 'small', onClick: clearEnded });
    heading.append(title, clear.element);
    const rows = ui.list({ maxRows: MAX_ROWS, key: (download) => download.id, create: rowOf, update: fill });
    body.append(heading, rows.element);
    popover.element.append(body);

    // Delegated, so a row drawn again never loses a press.
    rows.element.addEventListener('click', (event) => {
        const download = itemAt(event.target);
        if (download?.state === 'finished') downloads.open(download.id);
    });
    downloads.onChange(changed);
    downloads.list().then((listed) => {
        items = listed;
        draw();
    });

    return { element: button.element };

    function changed(download) {
        const known = items.some(({ id }) => id === download.id);
        items = known ? items.map((item) => (item.id === download.id ? download : item)) : [download, ...items];
        if (!known) bounce();
        draw();
    }

    function draw() {
        button.element.hidden = !items.length;
        button.element.toggleAttribute(
            'data-active',
            items.some(({ state }) => state === 'downloading')
        );
        clear.setEnabled(items.some(({ state }) => state !== 'downloading'));
        rows.set(items);
        if (!items.length) popover.close();
    }

    function toggle() {
        if (popover.isOpen()) popover.close();
        else popover.show(button.element);
    }

    function clearEnded() {
        const ended = items.filter(({ state }) => state !== 'downloading');
        items = items.filter(({ state }) => state === 'downloading');
        draw();
        for (const { id } of ended) downloads.remove(id);
    }

    function forget(id) {
        items = items.filter((download) => download.id !== id);
        draw();
        downloads.remove(id);
    }

    function itemAt(target) {
        const row = target.closest?.('.browser-download');
        const id = row && rows.keyOf(row);
        return items.find((download) => download.id === id) || null;
    }

    function rowOf(download) {
        const row = ui.row();
        row.element.classList.add('browser-download');
        const text = ui.element('div', { className: 'browser-download-text' });
        const name = ui.element('div', { className: 'browser-download-name' });
        const status = ui.element('div', { className: 'browser-download-status' });
        const bar = ui.element('div', { className: 'browser-download-bar' });
        bar.append(ui.element('div'));
        text.append(name, status, bar);
        row.element.append(text);
        fill(row.element, download);
        return row.element;
    }

    // The row of `download` as it is now, its action the one its state has.
    function fill(element, download) {
        const [name, status, bar] = element.querySelector('.browser-download-text').children;
        element.dataset.state = download.state;
        element.title = download.state === 'failed' ? download.error : download.path;
        name.textContent = download.name;
        status.textContent = statusOf(download);
        bar.firstChild.style.width = download.expected > 0 ? `${(100 * download.received) / download.expected}%` : '0';
        if (element.dataset.action === download.state) return;
        element.dataset.action = download.state;
        element.querySelector('.deckit-row-action')?.remove();
        element.append(actionOf(download).element);
    }

    function actionOf({ id, state }) {
        if (state === 'downloading')
            return ui.rowAction({
                icon: ui.icon('x', { size: ICON_SIZE }),
                title: 'Stop',
                onClick: () => downloads.cancel(id),
            });
        if (state === 'finished')
            return ui.rowAction({
                icon: ui.icon('search', { size: ICON_SIZE }),
                title: 'Show in Finder',
                onClick: () => downloads.reveal(id),
            });
        return ui.rowAction({
            icon: ui.icon('x', { size: ICON_SIZE }),
            title: 'Remove from list',
            onClick: () => forget(id),
        });
    }

    function statusOf({ state, received, expected }) {
        if (state === 'downloading')
            return expected > 0 ? `${sizeOf(received)} of ${sizeOf(expected)}` : sizeOf(received);
        if (state === 'finished') return sizeOf(received);
        return state === 'cancelled' ? 'Stopped' : 'Failed';
    }

    // Bytes as Finder counts them, in steps of 1000.
    function sizeOf(bytes) {
        let value = Math.max(0, bytes);
        let unit = 0;
        while (value >= 1000 && unit < UNITS.length - 1) {
            value /= 1000;
            unit++;
        }
        return unit ? `${value.toFixed(value < 10 ? 1 : 0)} ${UNITS[unit]}` : `${value} ${UNITS[0]}`;
    }

    function bounce() {
        if (!theme.motion.fast) return;
        button.element.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }], {
            duration: 220,
            easing: theme.motion.easing,
        });
    }
}

module.exports = { downloadList };
