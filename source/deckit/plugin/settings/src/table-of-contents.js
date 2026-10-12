// The sidebar's table of contents: a row per section of `scroller`, marking the one being read and gliding to the one
// pressed.
function tableOfContents({ ui, scroller, sections }) {
    const GLIDE_LIMIT = 1500;

    let current = sections[0];
    // While gliding, the row stays on the destination: following the scroll would light every section passed.
    let gliding = false;
    let glideTimer = null;

    ui.addStyle(`
        .settings-sidebar { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
        .settings-contents-label {
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `);
    const element = ui.element('div', { className: 'settings-sidebar' });
    const contents = ui.section({ label: 'Table of Contents', icon: ui.icon('tableOfContents', { size: 16 }) });
    const rows = new Map(); // section -> its row
    const list = ui.list({ key: (section) => section.title, create: contentsRow });

    list.set(sections);
    contents.body.append(list.element);
    element.append(contents.element);
    scroller.addEventListener('scrollend', () => {
        if (gliding) land();
    });
    scroller.addEventListener('scroll', follow, { passive: true });
    mark();
    return { element, go, reveal, follow };

    function go(section) {
        current = section;
        mark();
        const top = clampedTop(section.element, 4);
        // Already there: nothing scrolls, so no scrollend would end the glide.
        if (Math.abs(top - scroller.scrollTop) < 1) return;
        glide(top);
    }

    // Glides to `target`, an element inside `section`.
    function reveal(section, target) {
        current = section;
        mark();
        glide(clampedTop(target, 8));
    }

    function follow() {
        if (gliding) return;
        // At the very bottom, the last section, which may be too short to ever reach the top.
        const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
        const next = atEnd
            ? sections[sections.length - 1]
            : [...sections].reverse().find((section) => topOf(section.element) <= scroller.scrollTop + 48) ||
              sections[0];
        if (next === current) return;
        current = next;
        mark();
    }

    function glide(top) {
        gliding = true;
        clearTimeout(glideTimer);
        glideTimer = setTimeout(land, GLIDE_LIMIT);
        scroller.scrollTo({ top, behavior: 'smooth' });
    }

    function land() {
        gliding = false;
        clearTimeout(glideTimer);
        follow();
    }

    function mark() {
        for (const [section, row] of rows) row.setActive(section === current);
    }

    function contentsRow(section) {
        const row = ui.row();
        row.element.append(ui.element('span', { className: 'settings-contents-label', text: section.title }));
        row.element.addEventListener('click', () => go(section));
        rows.set(section, row);
        return row.element;
    }

    function topOf(target) {
        return target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    }

    // `margin` above the target, kept within what the scroller can scroll.
    function clampedTop(target, margin) {
        return Math.min(Math.max(0, topOf(target) - margin), scroller.scrollHeight - scroller.clientHeight);
    }
}

module.exports = { tableOfContents };
