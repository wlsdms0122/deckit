DeckitModule.define(
    'deckit/ui/component/drag',
    {
        uses: ['deckit/ui/token', 'deckit/ui/component/part'],
        provides: ['make'],
    },
    (T, K) => {
        const { MOTION } = T;

        const zones = new Map(); // zone element -> Set of { kind, placeAt, onDrop }

        /* Only the element under the pointer (past the veil) is asked about, never what lies under it: a
     zone that takes "not on a row" as its top folder would otherwise answer under a row it had just
     refused. */
        const landing = (x, y, kind, payload) => {
            const el = document.elementsFromPoint(x, y).find((e) => !('deckitVeil' in e.dataset));
            for (let n = el; n; n = n.parentElement) {
                for (const t of zones.get(n) || []) {
                    if (t.kind !== kind) continue;
                    const place = t.placeAt(el, payload);
                    if (place) return { target: t, place, at: el };
                }
            }
            return null;
        };
        // What scrolls under (x, y) inside a zone that takes `kind`, for the edges and the wheel.
        const scrollerAt = (x, y, kind) => {
            for (const el of document.elementsFromPoint(x, y)) {
                for (let n = el; n; n = n.parentElement) {
                    if ([...(zones.get(n) || [])].some((t) => t.kind === kind)) return K.scrollerOf(el);
                }
            }
            return null;
        };

        // The folder a "/"-separated path is in: "" for one at the top of a relative tree, "/" for one at the root of the disk.
        const parentOf = (p) => {
            const i = p.lastIndexOf('/');
            return i > 0 ? p.slice(0, i) : i === 0 ? '/' : '';
        };
        const movesInto = (from, folder) =>
            parentOf(from) !== folder && folder !== from && !folder.startsWith(from + '/');

        return {
            make: (theme, ui, inner) => {
                const { QUIET, HELD } = inner;
                /* The icon and name are one face inside the box, so the box can take the thing's shape with its
       face faded out. */
                const label = ({ text, icon: glyph }) => {
                    const tag = document.createElement('div');
                    Object.assign(tag.style, {
                        position: 'fixed',
                        left: '0',
                        top: '0',
                        zIndex: String(T.Z.modal + 50),
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        boxSizing: 'border-box',
                        maxWidth: '240px',
                        overflow: 'hidden',
                        padding: '4px 10px 4px 8px',
                        borderRadius: '7px',
                        border: theme.border,
                        background: HELD.fill,
                        boxShadow: HELD.shadow,
                        color: theme.contentColor,
                        font: '12.5px ' + theme.font,
                        whiteSpace: 'nowrap',
                    });
                    const face = document.createElement('span');
                    Object.assign(face.style, { display: 'flex', alignItems: 'center', gap: '6px', minWidth: '0' });
                    if (glyph) {
                        const g = document.createElement('span');
                        Object.assign(g.style, { display: 'flex', flex: '0 0 auto', color: QUIET });
                        g.innerHTML = /^\s*<svg/.test(glyph) ? glyph : T.icon(glyph, 14);
                        face.appendChild(g);
                    }
                    const words = document.createElement('span');
                    words.textContent = text;
                    Object.assign(words.style, { overflow: 'hidden', textOverflow: 'ellipsis' });
                    face.appendChild(words);
                    tag.appendChild(face);
                    return tag;
                };
                const RING = `inset 0 0 0 2px ${T.alpha(T.ACCENT, 0.75)}`;
                const STAYS = `inset 0 0 0 1.5px ${T.alpha(QUIET, 0.6)}`;

                return {
                    dragSource(area, { itemAt, what }) {
                        return K.press(area, {
                            pick: itemAt,
                            begin: (item, down, finished) => {
                                const it = what(item);
                                if (!it) return null;
                                const tag = label(it);
                                document.body.appendChild(tag);
                                const face = tag.firstChild;
                                const grab = { x: -12, y: -14 };
                                /* The label morphs out of the thing's box when lifted and back into it when taken back. A thing
               not all in sight has no box to use (it would be drawn over what covers it), so the label then
               starts as itself and, taken back, fades where it is. */
                                /* Measured to the fraction and rounded up: offsetWidth rounds to the nearest pixel, and a
               box half a pixel narrower than its name ellipsizes the end of it ("archi…"). */
                                const size = tag.getBoundingClientRect();
                                const chip = {
                                    width: Math.ceil(size.width),
                                    height: Math.ceil(size.height),
                                    radius: tag.style.borderRadius,
                                };
                                const home = () => {
                                    if (!K.inSight(item)) return null;
                                    const r = item.getBoundingClientRect();
                                    return {
                                        x: r.left,
                                        y: r.top,
                                        width: r.width,
                                        height: r.height,
                                        radius: getComputedStyle(item).borderRadius,
                                    };
                                };
                                const shape = (box, shown) => {
                                    Object.assign(tag.style, {
                                        width: box.width + 'px',
                                        height: box.height + 'px',
                                        borderRadius: box.radius,
                                    });
                                    face.style.opacity = shown ? '1' : '0';
                                };
                                tag.style.maxWidth = 'none';
                                shape(chip, true);
                                const keptOpacity = item.style.opacity;
                                const shownOpacity = getComputedStyle(item).opacity;
                                item.style.opacity = '.4';
                                let restoring = null; // the thing coming back to full while the label goes back into it
                                let at = null; // { place, kept }: the place lit now, and the ring it had before
                                const ringOf = (landed) => (landed.place.stays ? STAYS : RING);
                                const light = (next) => {
                                    if (at?.place.mark === next?.place.mark) {
                                        if (next) {
                                            at = { ...next, kept: at.kept };
                                            at.place.mark.style.boxShadow = ringOf(at);
                                        }
                                        return;
                                    }
                                    if (at) at.place.mark.style.boxShadow = at.kept;
                                    at = next ? { ...next, kept: next.place.mark.style.boxShadow } : null;
                                    if (at) at.place.mark.style.boxShadow = ringOf(at);
                                };
                                const moveTo = (x, y) => {
                                    tag.style.transform = `translate(${x}px, ${y}px)`;
                                };
                                const hangAt = (x, y) => moveTo(x - grab.x, y - grab.y);
                                const durationOf = (duration) => parseFloat(duration) || 0;
                                const morph = (duration) => {
                                    tag.style.transition = ['transform', 'width', 'height', 'border-radius']
                                        .map((p) => `${p} ${duration} ${MOTION.ease}`)
                                        .join(', ');
                                    face.style.transition = `opacity ${duration} ${MOTION.ease}`;
                                };
                                // A fade on top of whatever is moving it now, so a lift still under way is not cut short.
                                const fade = (duration, easing) => {
                                    tag.style.transition = [tag.style.transition, `opacity ${duration} ${easing}`]
                                        .filter(Boolean)
                                        .join(', ');
                                    tag.style.opacity = '0';
                                };
                                let lifting = 0,
                                    ending = 0;
                                const end = () => {
                                    clearTimeout(lifting);
                                    clearTimeout(ending);
                                    lifting = ending = 0;
                                    tag.remove();
                                    item.style.opacity = keptOpacity;
                                    restoring?.cancel();
                                    finished();
                                };
                                const landIn = () => {
                                    light(null);
                                    if (!durationOf(MOTION.fast)) return end();
                                    clearTimeout(lifting);
                                    fade(MOTION.fast, MOTION.ease);
                                    ending = setTimeout(end, durationOf(MOTION.fast));
                                };
                                const goBack = () => {
                                    light(null);
                                    const to = home();
                                    const duration = to ? MOTION.base : MOTION.fast;
                                    if (!durationOf(duration)) return end();
                                    clearTimeout(lifting);
                                    if (to) {
                                        morph(MOTION.base);
                                        moveTo(to.x, to.y);
                                        shape(to, false);
                                        // Faded late, so it is seen arriving in the thing's place and shape before it is gone.
                                        fade(MOTION.base, 'ease-in');
                                    } else fade(MOTION.fast, MOTION.ease);
                                    restoring = item.animate([{ opacity: 0.4 }, { opacity: shownOpacity }], {
                                        duration: durationOf(duration),
                                        easing: MOTION.ease,
                                        fill: 'forwards',
                                    });
                                    ending = setTimeout(end, durationOf(duration));
                                };
                                /* Moves during the lift retarget the same transition, so it catches up with the pointer rather
               than jumping to it. */
                                const from = home();
                                if (from && durationOf(MOTION.base)) {
                                    moveTo(from.x, from.y);
                                    shape(from, false);
                                    tag.getBoundingClientRect(); // where it starts, laid out before it moves
                                    morph(MOTION.base);
                                    shape(chip, true);
                                    lifting = setTimeout(() => {
                                        lifting = 0;
                                        tag.style.transition = '';
                                    }, durationOf(MOTION.base));
                                }
                                hangAt(down.clientX, down.clientY);
                                return {
                                    follow(x, y) {
                                        hangAt(x, y);
                                        light(landing(x, y, it.kind, it.payload));
                                    },
                                    drop(x, y) {
                                        const landed = landing(x, y, it.kind, it.payload);
                                        if (!landed || landed.place.stays) return goBack();
                                        landIn();
                                        landed.target.onDrop(it.payload, landed.place);
                                    },
                                    cancel: goBack,
                                    // A new press ends it at once, with nothing dropped.
                                    settleNow: () => {
                                        light(null);
                                        end();
                                    },
                                    scroller: (x, y) => scrollerAt(x, y, it.kind),
                                };
                            },
                        });
                    },

                    movesInto,

                    folderDrop(zone, { kind, path, folderAt, onDrop }) {
                        return ui.dropTarget(zone, {
                            kind,
                            onDrop,
                            placeAt: (at, held) => {
                                const place = folderAt(at);
                                if (!place) return null;
                                const from = path(held);
                                if (movesInto(from, place.folder)) return place;
                                return parentOf(from) === place.folder ? { ...place, stays: true } : null;
                            },
                        });
                    },
                    treeFolderAt({ row, markOf, top, topMark }) {
                        return (at) => {
                            const r = row(at);
                            if (!r) return { folder: top, mark: topMark };
                            const folder = r.folder ? r.path : parentOf(r.path);
                            return {
                                folder,
                                mark: folder === top ? topMark : r.folder ? r.el : markOf(folder) || r.el,
                                row: r,
                            };
                        };
                    },

                    dropTarget(zone, { kind, placeAt, onDrop }) {
                        const t = { kind, placeAt, onDrop };
                        if (!zones.has(zone)) zones.set(zone, new Set());
                        zones.get(zone).add(t);
                        return () => {
                            const set = zones.get(zone);
                            set?.delete(t);
                            if (set && !set.size) zones.delete(zone);
                        };
                    },
                };
            },
        };
    }
);
