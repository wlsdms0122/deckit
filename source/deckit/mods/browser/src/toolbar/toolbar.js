const { isWeb, placeOf } = require('../address/address.js');
const { favicon, stillLoading } = require('../favicon/favicon.js');
const { START } = require('../tabs/tab-list.js');

// The window's title bar, as the Browser's toolbar: Back and Forward, the field of the tab in front, and `trailing` at
// its end. The field holds the site's icon, which opens its permissions, the site, and Reload and the bookmark star of
// the page. A press on the site edits the address. `onBookmark()` is a press on the star.
function toolbar({ ui, trailing, onBack, onForward, onReload, onSitePermissions, onBookmark, onSubmit }) {
    const ICON_SIZE = 16;

    let shownTab = null;

    ui.addStyle(`
        /* A kit field, so it is drawn and ringed as one, holding buttons of its own, centred in the title's place. */
        .browser-address-field { max-width: 640px; margin: 0 auto; gap: 0; padding: 0 2px; cursor: default; }
        .browser-address-field .browser-address-page { border-radius: var(--deckit-radius-round); }
        .browser-address-site {
            flex: 0 0 auto;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            padding: 0;
            border: 0;
            border-radius: var(--deckit-radius-round);
            background: transparent;
        }
        .browser-address,
        .browser-address-input {
            flex: 1 1 auto;
            min-width: 0;
            height: 28px;
            padding: 0 6px 0 10px;
            border: 0;
            background: transparent;
            color: var(--deckit-text);
            font: var(--deckit-type-body);
        }
        /* Edited, the address reaches the field's round end, its page's buttons hidden: it keeps clear of the curve. */
        .browser-address-input { padding-right: 14px; }
        .browser-address {
            display: flex;
            align-items: center;
            border-radius: var(--deckit-radius-round);
            cursor: text;
            text-align: left;
            white-space: nowrap;
        }
        .browser-address-place { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .browser-address-input { display: none; outline: none; }
        .browser-toolbar[data-editing] .browser-address,
        .browser-toolbar[data-editing] .browser-address-page { display: none; }
        .browser-toolbar[data-editing] .browser-address-input { display: block; }
    `);
    const back = ui.iconButton({ icon: ui.icon('chevronLeft', { size: ICON_SIZE }), title: 'Back', onClick: onBack });
    const forward = ui.iconButton({
        icon: ui.icon('chevronRight', { size: ICON_SIZE }),
        title: 'Forward',
        onClick: onForward,
    });

    const field = ui.element('div', { className: 'deckit-field browser-address-field' });
    const site = ui.element('button', { className: 'browser-address-site' });
    site.type = 'button';
    site.title = 'Site permissions';
    ui.pressable(site);
    site.addEventListener('click', onSitePermissions);
    const address = ui.element('button', { className: 'browser-address' });
    address.type = 'button';
    ui.pressable(address);
    const place = ui.element('span', { className: 'browser-address-place' });
    address.append(place);
    const input = ui.element('input', { className: 'browser-address-input' });
    input.setAttribute('aria-label', 'Address');
    input.spellcheck = false;
    const reload = ui.iconButton({
        icon: ui.icon('reload', { size: ICON_SIZE }),
        title: 'Reload',
        onClick: onReload,
    });
    const star = ui.iconButton({ icon: starIcon(false), title: 'Bookmark', onClick: bookmark });
    for (const button of [reload, star]) button.element.classList.add('browser-address-page');
    field.append(site, address, input, reload.element, star.element);
    // The page under the bar is no kit content, so a rule marks the edge the kit's fade cannot.
    const { element } = ui.titleBar({
        leading: [back.element, forward.element],
        title: field,
        trailing: [trailing],
        hairline: true,
    });
    element.classList.add('browser-toolbar');

    address.addEventListener('click', edit);
    input.addEventListener('blur', stopEditing);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') return input.blur();
        if (event.key !== 'Enter') return;
        const text = input.value.trim();
        if (shownTab && text) onSubmit(text);
        input.blur();
    });

    return { element, show, edit };

    // A page off the web has no site to give permissions to.
    function show(tab, { bookmarked }) {
        const same = tab === shownTab;
        shownTab = tab;
        back.setEnabled(tab.canGoBack);
        forward.setEnabled(tab.canGoForward);
        if (!same || !stillLoading(site, tab)) site.replaceChildren(favicon({ ui, page: tab }).element);
        site.disabled = !isWeb(tab.url);
        place.textContent = placeOf(tab.url);
        star.setIcon(starIcon(bookmarked));
        star.setPressed(bookmarked);
    }

    function edit() {
        if (!shownTab) return;
        element.toggleAttribute('data-editing', true);
        input.value = shownTab.url === START ? '' : shownTab.url;
        input.focus();
        input.select();
    }

    function stopEditing() {
        element.removeAttribute('data-editing');
    }

    function bookmark() {
        if (shownTab) onBookmark();
    }

    function starIcon(on) {
        return ui.icon('star', { size: ICON_SIZE, fill: on ? 'currentColor' : 'none' });
    }
}

module.exports = { toolbar };
