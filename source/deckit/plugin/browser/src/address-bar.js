const { isWeb, placeOf } = require('./address.js');
const { favicon } = require('./favicon.js');

// The address bar, floating over the page in the corner it is dragged to. At rest it shows the site; a press opens it
// with the page's controls, and a press on the open address edits it.
function addressBar({ theme, ui, values, area, onBack, onForward, onReload, onSitePermissions, onBookmark, onSubmit }) {
    const CORNER_KEY = 'island-corner';
    const DRAG_THRESHOLD = 4;
    // How long after a drag settles the click it ends with may still arrive, in ms.
    const SETTLED_CLICK_LENGTH = 400;

    let corner = values.get(CORNER_KEY, 'tl');
    let shownTab = null;
    let open = false;
    let editing = false;
    // When the last drag settled: the click the browser sends after it is already answered.
    let settledAt = 0;

    // The bar is as wide as its contents, so its parts animate their own widths and the bar follows. The title is
    // spaced by padding, which goes to 0 with its width; a flex gap is drawn even beside an item with no width.
    // Padding of 2px a side puts every 30px control 3px from the edge of the 36px bar with its 1px border.
    ui.addStyle(`
        .browser-address-bar {
            z-index: 2;
            display: flex;
            align-items: center;
            padding: 0 2px;
            width: max-content;
            max-width: calc(100% - 20px);
            overflow: hidden;
            white-space: nowrap;
            cursor: grab;
            transition:
                top var(--deckit-base) var(--deckit-easing),
                bottom var(--deckit-base) var(--deckit-easing),
                transform var(--deckit-base) var(--deckit-easing),
                box-shadow var(--deckit-base) var(--deckit-easing),
                background-color var(--deckit-base) var(--deckit-easing);
        }
        .browser-address-bar:not([data-open]) {
            background: color-mix(in srgb, var(--deckit-background) 72%, transparent);
        }
        .browser-address-bar[data-open] { box-shadow: var(--deckit-shadow-raised); }
        .browser-address-bar[data-corner^='t'] { top: 8px; }
        .browser-address-bar[data-corner^='b'] { bottom: 10px; }
        .browser-address-bar[data-corner$='l'] { left: calc(10px + var(--deckit-title-bar-area-x, 0px)); }
        .browser-address-bar[data-corner$='r'] { right: 10px; }
        .browser-address-bar .browser-address-button { border-radius: var(--deckit-radius-round); }
        .browser-address-controls {
            display: flex;
            align-items: center;
            flex: 0 0 auto;
            width: 0;
            opacity: 0;
            overflow: hidden;
            transition:
                width var(--deckit-base) var(--deckit-easing),
                opacity var(--deckit-base) var(--deckit-easing);
        }
        .browser-address-bar[data-open] .browser-address-controls { width: 90px; opacity: 1; }
        .browser-address-bar .browser-address-wing {
            width: 0;
            opacity: 0;
            overflow: hidden;
            transition:
                width var(--deckit-base) var(--deckit-easing),
                opacity var(--deckit-base) var(--deckit-easing),
                background-color var(--deckit-fast) var(--deckit-easing);
        }
        .browser-address-bar[data-open] .browser-address-star,
        .browser-address-bar[data-open][data-web] .browser-address-site { width: 30px; opacity: 1; }
        .browser-address {
            flex: 0 1 auto;
            min-width: 0;
            display: flex;
            align-items: center;
            height: 30px;
            padding: 0 10px;
            border-radius: var(--deckit-radius-round);
            border: 0;
            background: transparent;
            color: var(--deckit-text);
            cursor: text;
            font: var(--deckit-type-body);
            text-align: left;
            overflow: hidden;
        }
        .browser-address-icon { flex: 0 0 auto; display: flex; align-items: center; margin-right: 6px; }
        .browser-address-place {
            white-space: nowrap;
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 260px;
        }
        .browser-address-title {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            opacity: 0;
            max-width: 0;
            padding-left: 0;
            box-sizing: border-box;
            transition:
                max-width var(--deckit-base) var(--deckit-easing),
                opacity var(--deckit-base) var(--deckit-easing),
                padding-left var(--deckit-base) var(--deckit-easing);
        }
        .browser-address-bar[data-open] .browser-address-title { max-width: 360px; opacity: 0.55; padding-left: 6px; }
        .browser-address-input {
            display: none;
            flex: 0 0 auto;
            width: min(46vw, 420px);
            min-width: 0;
            height: 28px;
            margin: 0 2px;
            padding: 0 10px;
            border-radius: var(--deckit-radius-round);
            border: 0;
            background: var(--deckit-hover);
            color: var(--deckit-text);
            font: var(--deckit-type-body);
            outline: none;
        }
        .browser-address-bar[data-editing] .browser-address { display: none; }
        .browser-address-bar[data-editing] .browser-address-input { display: block; }
    `);
    const element = ui.element('div', { className: 'browser-floating browser-address-bar' });
    const back = ui.iconButton({ icon: ui.icon('chevronLeft', { size: 17 }), title: 'Back', onClick: onBack });
    const forward = ui.iconButton({
        icon: ui.icon('chevronRight', { size: 17 }),
        title: 'Forward',
        onClick: onForward,
    });
    const reload = ui.iconButton({ icon: ui.icon('reload', { size: 15 }), title: 'Reload', onClick: onReload });
    const controls = ui.element('div', { className: 'browser-address-controls' });
    controls.append(back.element, forward.element, reload.element);
    const address = ui.element('button', { className: 'browser-address' });
    address.type = 'button';
    ui.pressable(address);
    const icon = ui.element('span', { className: 'browser-address-icon' });
    const place = ui.element('span', { className: 'browser-address-place' });
    const title = ui.element('span', { className: 'browser-address-title' });
    address.append(icon, place, title);
    const input = ui.element('input', { className: 'browser-address-input' });
    input.spellcheck = false;
    const site = ui.iconButton({
        icon: ui.icon('gear', { size: 15 }),
        title: 'Site permissions',
        onClick: onSitePermissions,
    });
    site.element.classList.add('browser-address-wing', 'browser-address-site');
    const star = ui.iconButton({ icon: starIcon(false), title: 'Bookmark', onClick: bookmark });
    star.element.classList.add('browser-address-wing', 'browser-address-star');
    for (const button of [back, forward, reload, site, star]) button.element.classList.add('browser-address-button');
    element.append(controls, address, input, site.element, star.element);
    element.dataset.corner = corner;

    element.addEventListener('dragstart', (event) => event.preventDefault());
    // A press anywhere else in the page closes it.
    document.addEventListener(
        'pointerdown',
        (event) => {
            if (!element.contains(event.target)) setOpen(false);
        },
        true
    );
    // A pointer press is answered by the drag below, which knows whether the pointer travelled; this click is what
    // keyboard activation reaches.
    address.addEventListener('click', () => {
        if (!answered()) press();
    });
    input.addEventListener('blur', stopEditing);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') return stopEditing();
        if (event.key !== 'Enter') return;
        const text = input.value.trim();
        if (shownTab && text) onSubmit(text);
        stopEditing();
    });
    element.addEventListener('pointerdown', drag);
    element.addEventListener(
        'click',
        (event) => {
            if (answered()) event.stopPropagation();
        },
        true
    );

    return { element, show, close: () => setOpen(false), edit, isInTopRight: () => corner === 'tr' };

    function show(tab, { bookmarked }) {
        shownTab = tab;
        back.setEnabled(tab.canGoBack);
        forward.setEnabled(tab.canGoForward);
        place.textContent = placeOf(tab.url);
        icon.replaceChildren(favicon({ ui, page: tab }).element);
        title.textContent = tab.title;
        star.setIcon(starIcon(bookmarked));
        element.toggleAttribute('data-web', isWeb(tab.url));
    }

    function edit() {
        if (!shownTab) return;
        editing = true;
        element.toggleAttribute('data-editing', true);
        input.value = shownTab.url;
        setOpen(true);
        input.focus();
        input.select();
    }

    function stopEditing() {
        editing = false;
        element.removeAttribute('data-editing');
    }

    // Kept open while the caret is in the address.
    function setOpen(on) {
        if (open === on) return;
        if (!on && editing) return;
        open = on;
        element.toggleAttribute('data-open', on);
    }

    function press() {
        if (open) edit();
        else setOpen(true);
    }

    function bookmark() {
        if (!shownTab) return;
        onBookmark();
        if (!theme.motion.fast) return;
        star.element.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }], {
            duration: 220,
            easing: theme.motion.easing,
        });
    }

    function answered() {
        return Date.now() - settledAt < SETTLED_CLICK_LENGTH;
    }

    // Past DRAG_THRESHOLD a press is a drag and its click is swallowed. Letting go sets the new corner first and then
    // animates from where the bar was, so an animation that never plays (the window in the background) still leaves
    // it where it belongs.
    function drag(down) {
        if (down.button !== 0) return;
        if ([input, controls, site.element, star.element].some((part) => part.contains(down.target))) return;
        // The press keeps its default, which takes the focus back from the page: a drag begun while the page had the
        // keyboard would never finish.
        // Captured at once: a quick flick leaves the 36px bar on the first move, which would go to the page.
        element.setPointerCapture(down.pointerId);
        // The cover goes up at once too: the browser process routes the next move before capture takes effect.
        const uncover = ui.capturePointer('grabbing');
        const bounds = area.getBoundingClientRect();
        let moved = false;
        let done = false;

        window.addEventListener('pointermove', follow, true);
        window.addEventListener('pointerdown', pressAgain, true);
        window.addEventListener('pointerup', finish, true);
        window.addEventListener('pointercancel', finish, true);
        window.addEventListener('blur', finish);
        element.addEventListener('lostpointercapture', finish);

        function follow(event) {
            if (event.pointerId !== down.pointerId) return;
            if (!(event.buttons & 1)) return finish(event);
            const offsetX = event.clientX - down.clientX;
            const offsetY = event.clientY - down.clientY;
            if (!moved) {
                if (Math.hypot(offsetX, offsetY) < DRAG_THRESHOLD) return;
                moved = true;
                element.style.cursor = 'grabbing';
                element.style.transition = 'none';
            }
            element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        }

        function pressAgain(event) {
            if (event !== down) finish(null);
        }

        // The one way out, however the gesture ends: the cover takes the whole panel, so a gesture that never
        // finishes swallows every later press.
        function finish(event) {
            if (done) return;
            done = true;
            window.removeEventListener('pointermove', follow, true);
            window.removeEventListener('pointerup', finish, true);
            window.removeEventListener('pointercancel', finish, true);
            window.removeEventListener('blur', finish);
            window.removeEventListener('pointerdown', pressAgain, true);
            element.removeEventListener('lostpointercapture', finish);
            // Throws when the capture is already gone.
            try {
                element.releasePointerCapture(down.pointerId);
            } catch {}
            uncover();
            settledAt = Date.now();
            // It never travelled: a press, answered here because its click is swallowed.
            if (!moved) {
                if (event?.type === 'pointerup') press();
                return;
            }
            element.style.cursor = '';

            const from = element.getBoundingClientRect();
            corner =
                (from.top + from.height / 2 < bounds.top + bounds.height / 2 ? 't' : 'b') +
                (from.left + from.width / 2 < bounds.left + bounds.width / 2 ? 'l' : 'r');
            values.set(CORNER_KEY, corner);
            element.style.transform = '';
            element.dataset.corner = corner;
            // Measured with the transition still off, so the corner change is settled here and restoring the
            // transition does not also animate `top` behind the animation below.
            const to = element.getBoundingClientRect();
            element.style.transition = '';
            const offsetX = from.left - to.left;
            const offsetY = from.top - to.top;
            if (!theme.motion.base || !(offsetX || offsetY)) return;
            element.animate(
                [{ transform: `translate(${offsetX}px, ${offsetY}px)` }, { transform: 'translate(0, 0)' }],
                {
                    duration: theme.motion.base,
                    easing: theme.motion.easing,
                }
            );
        }
    }

    function starIcon(on) {
        return ui.icon('star', { size: 16, fill: on ? 'currentColor' : 'none' });
    }
}

module.exports = { addressBar };
