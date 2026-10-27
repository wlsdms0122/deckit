const { isWeb, placeOf } = require('../address/address.js');
const { favicon } = require('../favicon/favicon.js');

// The view's title bar, as the Browser's toolbar: Back and Forward, and the field of the tab in front. The field holds
// the site's icon, which opens its permissions, the site, and Reload and the bookmark star of the page. A press on the
// site edits the address. `onBookmark(star)` is a press on the star.
function toolbar({ theme, ui, onBack, onForward, onReload, onSitePermissions, onBookmark, onSubmit }) {
    const ICON_SIZE = 16;

    let shownTab = null;

    // The field is centred in the bar, as wide as the room between the two sides lets it be.
    ui.addStyle(`
        .browser-toolbar {
            flex: 0 0 auto;
            display: grid;
            grid-template-columns: 1fr minmax(0, 640px) 1fr;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
        }
        .browser-toolbar-side { display: flex; align-items: center; gap: 2px; }
        .browser-address-field {
            display: flex;
            align-items: center;
            min-width: 0;
            height: 32px;
            padding: 0 2px;
            border-radius: var(--deckit-radius-round);
            background: var(--deckit-fill);
        }
        .browser-toolbar[data-editing] .browser-address-field { box-shadow: inset 0 0 0 1px var(--deckit-focus); }
        .browser-address-field .deckit-icon-button { border-radius: var(--deckit-radius-round); }
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
            padding: 0 6px;
            border: 0;
            background: transparent;
            color: var(--deckit-text);
            font: var(--deckit-type-body);
        }
        .browser-address {
            display: flex;
            align-items: center;
            border-radius: var(--deckit-radius-round);
            cursor: text;
            text-align: left;
            white-space: nowrap;
        }
        .browser-address-place { min-width: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
        .browser-address-input { display: none; outline: none; }
        .browser-toolbar[data-editing] .browser-address,
        .browser-toolbar[data-editing] .browser-address-page { display: none; }
        .browser-toolbar[data-editing] .browser-address-input { display: block; }
    `);
    const element = ui.element('div', { className: 'browser-toolbar' });
    ui.titleBar(element);
    const back = ui.iconButton({ icon: ui.icon('chevronLeft', { size: ICON_SIZE }), title: 'Back', onClick: onBack });
    const forward = ui.iconButton({
        icon: ui.icon('chevronRight', { size: ICON_SIZE }),
        title: 'Forward',
        onClick: onForward,
    });
    const leading = ui.element('div', { className: 'browser-toolbar-side' });
    leading.append(back.element, forward.element);

    const field = ui.element('div', { className: 'browser-address-field' });
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
    input.spellcheck = false;
    const reload = ui.iconButton({
        icon: ui.icon('reload', { size: ICON_SIZE }),
        title: 'Reload',
        onClick: onReload,
    });
    const star = ui.iconButton({ icon: starIcon(false), title: 'Bookmark', onClick: bookmark });
    for (const button of [reload, star]) button.element.classList.add('browser-address-page');
    field.append(site, address, input, reload.element, star.element);
    element.append(leading, field, ui.element('div'));

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
        shownTab = tab;
        back.setEnabled(tab.canGoBack);
        forward.setEnabled(tab.canGoForward);
        site.replaceChildren(favicon({ ui, page: tab }).element);
        site.disabled = !isWeb(tab.url);
        place.textContent = placeOf(tab.url);
        star.setIcon(starIcon(bookmarked));
    }

    function edit() {
        if (!shownTab) return;
        element.toggleAttribute('data-editing', true);
        input.value = shownTab.url;
        input.focus();
        input.select();
    }

    function stopEditing() {
        element.removeAttribute('data-editing');
    }

    function bookmark() {
        if (!shownTab) return;
        onBookmark(star.element);
        if (!theme.motion.fast) return;
        star.element.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }], {
            duration: 220,
            easing: theme.motion.easing,
        });
    }

    function starIcon(on) {
        return ui.icon('star', { size: ICON_SIZE, fill: on ? 'currentColor' : 'none' });
    }
}

module.exports = { toolbar };
