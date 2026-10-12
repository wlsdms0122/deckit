DeckitModule.define(
    'deckit/ui/component/drag',
    {
        uses: [
            'deckit/ui/token',
            'deckit/ui/icon',
            'deckit/ui/overlay',
            'deckit/ui/scroll',
            'deckit/ui/gesture',
            'deckit/ui/list',
        ],
        provides: ['STYLE', 'make'],
    },
    (TOKEN, ICON, OVERLAY, SCROLL, GESTURE, LIST) => {
        // MARK: - Property
        // The label is one face inside a box, so the box can take the dragged thing's shape with its face faded out.
        const STYLE = `
            .deckit-drag-label {
                position: fixed;
                left: 0;
                top: 0;
                display: flex;
                align-items: center;
                max-width: 240px;
                box-sizing: border-box;
                overflow: hidden;
                padding: 4px 10px 4px 8px;
                border: var(--deckit-border);
                border-radius: 7px;
                background: var(--deckit-lifted);
                box-shadow: var(--deckit-shadow-lifted);
                color: var(--deckit-text);
                font: var(--deckit-type-small);
                white-space: nowrap;
                pointer-events: none;
            }
            .deckit-drag-face { display: flex; align-items: center; gap: 6px; min-width: 0; }
            .deckit-drag-icon { display: flex; flex: 0 0 auto; color: var(--deckit-muted); }
            .deckit-drag-text { overflow: hidden; text-overflow: ellipsis; }
            [data-deckit-drop='stays'] { outline: 1.5px solid color-mix(in srgb, var(--deckit-muted) 60%, transparent); outline-offset: -1.5px; }
        `;
        // Where the label hangs from the pointer.
        const GRAB = { x: -12, y: -14 };
        const LIFTED_OPACITY = 0.4;
        const zones = new Map(); // zone element -> Set of { kind, placeAt, onDrop }

        // MARK: - Initializer
        // MARK: - Public
        function make() {
            return { dragSource, dropTarget };
        }

        // MARK: - Private
        // Things in `area` that can be dragged. `itemAt(target)` finds one under a press; `describe(item)` says what it
        // carries: { kind, payload, text, icon }, or null when it cannot be dragged. A drop target of the same kind takes
        // it. Returns the dispose.
        function dragSource(area, { itemAt, describe }) {
            return GESTURE.drag(area, {
                pick: itemAt,
                begin: LIST.heldWhile(area, (item, down, finished) => {
                    const carried = describe(item);
                    return carried ? carry(item, carried, down, finished) : null;
                }),
            });
        }

        // Where a dragged thing of `kind` can land in `zone`: `placeAt(element, payload)` answers the place under the
        // pointer ({ mark, stays }) or null, `onDrop(payload, place)` takes it. `mark` is what lights while the thing is
        // over it; a place that `stays` is where the thing already is. Returns the dispose.
        function dropTarget(zone, { kind, placeAt, onDrop }) {
            const target = { kind, placeAt, onDrop };
            if (!zones.has(zone)) zones.set(zone, new Set());
            zones.get(zone).add(target);
            return () => {
                const targets = zones.get(zone);
                targets?.delete(target);
                if (targets && !targets.size) zones.delete(zone);
            };
        }

        // The label morphs out of the thing's box when lifted and back into it when taken back. A thing not all in sight
        // has no box to use (it would be drawn over what covers it), so the label then starts as itself and, taken back,
        // fades where it is.
        function carry(item, { kind, payload, text, icon }, down, finished) {
            const MOTION = TOKEN.MOTION;
            const label = labelOf(text, icon);
            const face = label.firstChild;
            document.body.append(label);
            // Measured to the fraction and rounded up: a box half a pixel narrower than its name ellipsizes its end.
            const measured = label.getBoundingClientRect();
            const chip = {
                width: Math.ceil(measured.width),
                height: Math.ceil(measured.height),
                radius: label.style.borderRadius,
            };
            const home = () => {
                if (!SCROLL.isFullyVisible(item)) return null;
                const box = item.getBoundingClientRect();
                return {
                    x: box.left,
                    y: box.top,
                    width: box.width,
                    height: box.height,
                    radius: getComputedStyle(item).borderRadius,
                };
            };
            const shape = (box, shown) => {
                Object.assign(label.style, {
                    width: box.width + 'px',
                    height: box.height + 'px',
                    borderRadius: box.radius,
                });
                face.style.opacity = shown ? '1' : '0';
            };
            const moveTo = (x, y) => (label.style.transform = `translate(${x}px, ${y}px)`);
            const hangAt = (x, y) => moveTo(x - GRAB.x, y - GRAB.y);
            const morph = (length) => {
                label.style.transition = ['transform', 'width', 'height', 'border-radius']
                    .map((property) => `${property} ${length}ms ${MOTION.easing}`)
                    .join(', ');
                face.style.transition = `opacity ${length}ms ${MOTION.easing}`;
            };
            // A fade on top of whatever is moving it now, so a lift still under way is not cut short.
            const fade = (length, easing) => {
                label.style.transition = [label.style.transition, `opacity ${length}ms ${easing}`]
                    .filter(Boolean)
                    .join(', ');
                label.style.opacity = '0';
            };
            label.style.maxWidth = 'none';
            shape(chip, true);
            const keptOpacity = item.style.opacity;
            const shownOpacity = getComputedStyle(item).opacity;
            item.style.opacity = String(LIFTED_OPACITY);
            let restoring = null; // the thing coming back to full while the label goes back into it
            let lit = null; // the mark lit now
            let lifting = 0;
            let ending = 0;
            // The mark a thing would land in is ringed; the one it already is in, faintly.
            const unlight = () => {
                lit?.removeAttribute('data-deckit-drop');
                lit?.removeAttribute('data-deckit-target');
                lit = null;
            };
            const light = ({ place }) => {
                if (lit !== place.mark) unlight();
                lit = place.mark;
                lit.setAttribute('data-deckit-drop', place.stays ? 'stays' : 'lands');
                lit.toggleAttribute('data-deckit-target', !place.stays);
            };
            const end = () => {
                clearTimeout(lifting);
                clearTimeout(ending);
                label.remove();
                item.style.opacity = keptOpacity;
                restoring?.cancel();
                finished();
            };
            const landIn = () => {
                unlight();
                if (!MOTION.fast) return end();
                clearTimeout(lifting);
                fade(MOTION.fast, MOTION.easing);
                ending = setTimeout(end, MOTION.fast);
            };
            const goBack = () => {
                unlight();
                const to = home();
                const length = to ? MOTION.base : MOTION.fast;
                if (!length) return end();
                clearTimeout(lifting);
                if (to) {
                    morph(length);
                    moveTo(to.x, to.y);
                    shape(to, false);
                    // Faded late, so it is seen arriving in the thing's place and shape before it is gone.
                    fade(length, 'ease-in');
                } else fade(length, MOTION.easing);
                restoring = item.animate([{ opacity: LIFTED_OPACITY }, { opacity: shownOpacity }], {
                    duration: length,
                    easing: MOTION.easing,
                    fill: 'forwards',
                });
                ending = setTimeout(end, length);
            };
            // Moves during the lift retarget the same transition, so it catches up with the pointer instead of jumping.
            const from = home();
            if (from && MOTION.base) {
                moveTo(from.x, from.y);
                shape(from, false);
                void label.offsetHeight;
                morph(MOTION.base);
                shape(chip, true);
                lifting = setTimeout(() => (label.style.transition = ''), MOTION.base);
            }
            hangAt(down.clientX, down.clientY);
            return {
                follow: (x, y) => {
                    hangAt(x, y);
                    const landed = landing(x, y, kind, payload);
                    if (landed) light(landed);
                    else unlight();
                },
                drop: (x, y) => {
                    const landed = landing(x, y, kind, payload);
                    if (!landed || landed.place.stays) return goBack();
                    landIn();
                    landed.target.onDrop(payload, landed.place);
                },
                cancel: goBack,
                // A new press ends it at once, with nothing dropped.
                settleNow: () => {
                    unlight();
                    end();
                },
                scroller: (x, y) => scrollerAt(x, y, kind),
            };
        }

        function labelOf(text, icon) {
            const label = element('div', 'deckit-drag-label');
            label.style.zIndex = String(OVERLAY.Z.drag);
            const face = element('span', 'deckit-drag-face');
            if (icon) {
                const glyph = element('span', 'deckit-drag-icon');
                glyph.innerHTML = /^\s*<svg/.test(icon) ? icon : ICON.icon(icon, { size: 14 });
                face.append(glyph);
            }
            const words = element('span', 'deckit-drag-text');
            words.textContent = text;
            face.append(words);
            label.append(face);
            return label;
        }

        // Only the element under the pointer (past the capture cover) is asked about, never what lies under it: a zone
        // that takes "not on a row" as its top folder would otherwise answer under a row it had just refused.
        function landing(x, y, kind, payload) {
            const under = document.elementsFromPoint(x, y).find((element) => !('deckitCapture' in element.dataset));
            for (let node = under; node; node = node.parentElement) {
                for (const target of zones.get(node) || []) {
                    if (target.kind !== kind) continue;
                    const place = target.placeAt(under, payload);
                    if (place) return { target, place };
                }
            }
            return null;
        }

        // What scrolls under (x, y) inside a zone that takes `kind`, for the edges and the wheel.
        function scrollerAt(x, y, kind) {
            for (const under of document.elementsFromPoint(x, y)) {
                for (let node = under; node; node = node.parentElement) {
                    if ([...(zones.get(node) || [])].some((target) => target.kind === kind))
                        return SCROLL.scrollerOf(under);
                }
            }
            return null;
        }

        function element(tag, className) {
            const made = document.createElement(tag);
            made.className = className;
            return made;
        }

        return { STYLE, make };
    }
);
