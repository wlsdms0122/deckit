// The sidebar's table of contents: a row per section of `scroller`, by its glyph and title, marking the one being read
// and gliding to the one pressed or reached by the keys.
function tableOfContents({ ui, scroller, sections }) {
    const GLIDE_LIMIT = 1500;

    let current = sections[0];
    // While gliding, the row stays on the destination: following the scroll would light every section passed.
    let gliding = false;
    let glideTimer = null;

    ui.addStyle(`
        /* No heading: the window's title names what the rows are of. */
        .settings-sidebar { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; padding-top: 10px; }
        .settings-contents-label {
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `);
    const element = ui.element('div', { className: 'settings-sidebar' });
    const rows = new Map(); // section -> its row
    const list = ui.list({ key: (section) => section.title, create: contentsRow });

    list.set(sections);
    // The arrows and a name typed go from section to section, as a press on a row does.
    ui.tree(list.element, {
        items: () => sections,
        lead: () => current,
        nameOf: (section) => section.title,
        onSelect: (section) => go(section),
    });
    element.append(list.element);
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
        const row = ui.row({ glyph: ui.icon(section.glyph, { size: 16 }) });
        row.element.append(ui.element('span', { className: 'settings-contents-label', text: section.title }));
        row.element.addEventListener('click', () => go(section));
        rows.set(section, row);
        return row.element;
    }

    function topOf(target) {
        return target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    }

    // `margin` above the target, past the scroller's faded edge (its `scroll-padding`), kept within what the scroller
    // can scroll.
    function clampedTop(target, margin) {
        const edge = parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0;
        return Math.min(Math.max(0, topOf(target) - edge - margin), scroller.scrollHeight - scroller.clientHeight);
    }
}

module.exports = { tableOfContents };
