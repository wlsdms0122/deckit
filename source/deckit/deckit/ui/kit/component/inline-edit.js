DeckitModule.define(
    'deckit/ui/kit/component/inline-edit',
    {
        uses: ['deckit/ui/token', 'deckit/ui/kit/part'],
        provides: ['make'],
    },
    (T, K) => {
        const { Z } = T;

        return {
            make: (theme, ui, inner) => {
                return {
                    inlineEdit(label, { stem = false, commit }) {
                        const was = label.textContent;
                        const row = label.parentElement;
                        const look = getComputedStyle(label);
                        const input = document.createElement('input');
                        input.value = was;
                        input.spellcheck = false;
                        // Held, so a redraw of the list waits instead of taking the field away mid-word.
                        input.dataset.deckitHeld = '';
                        /* A label that took the row's spare width leaves it to the field's margin; one that did not
           keeps what follows right after it. */
                        Object.assign(input.style, {
                            flex: '0 1 auto',
                            fieldSizing: 'content',
                            minWidth: '48px',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                            margin: '-2px 0 -2px -4px',
                            marginRight: parseFloat(look.flexGrow) > 0 ? 'auto' : '0',
                            padding: '1px 4px',
                            border: '0',
                            outline: 'none',
                            borderRadius: '4px',
                            font: look.font,
                            letterSpacing: look.letterSpacing,
                            color: theme.contentColor,
                            background: theme.contentBg,
                            boxShadow: `0 0 0 2px ${T.FOCUS_RING}`,
                        });
                        // So a list it is in (a menu, a drag) does not act on a press or a text drag inside it.
                        for (const type of [
                            'pointerdown',
                            'mousedown',
                            'click',
                            'dblclick',
                            'contextmenu',
                            'dragstart',
                        ]) {
                            input.addEventListener(type, (e) => e.stopPropagation());
                        }
                        // Given back only by Enter or Escape: a field left by a click lets the click decide where focus goes.
                        const before = document.activeElement;
                        const giveBack = () => {
                            const to =
                                before && before !== document.body && before.isConnected
                                    ? before
                                    : row?.closest?.('[tabindex]');
                            to?.focus?.({ preventScroll: true });
                        };
                        const shown = label.style.display;
                        label.style.display = 'none';
                        label.after(input);
                        input.focus();
                        const dot = was.lastIndexOf('.');
                        input.setSelectionRange(0, stem && dot > 0 ? dot : was.length);
                        input.scrollIntoView({ block: 'nearest' });

                        let note = null;
                        const unsay = () => {
                            note?.remove();
                            note = null;
                        };
                        const say = (why, under, ms = 0) => {
                            unsay();
                            note = inner.menuBox();
                            const at = under.getBoundingClientRect();
                            Object.assign(note.style, {
                                zIndex: String(Z.popover),
                                maxWidth: '280px',
                                padding: '6px 9px',
                                whiteSpace: 'normal',
                                left: at.left + 'px',
                                top: at.bottom + 6 + 'px',
                                color: T.TONE.alert,
                            });
                            note.textContent = why;
                            document.body.appendChild(note);
                            if (ms) {
                                const mine = note;
                                setTimeout(() => {
                                    if (note === mine) unsay();
                                }, ms);
                            }
                        };

                        return new Promise((resolve) => {
                            let over = false,
                                asking = false;
                            const end = (renamed, text) => {
                                if (over) return;
                                over = true;
                                unsay();
                                if (renamed) label.textContent = text;
                                const held = document.activeElement === input;
                                input.remove();
                                label.style.display = shown;
                                if (held) giveBack();
                                if (row) K.freed(row);
                                resolve(renamed);
                            };
                            const take = async (stay) => {
                                if (over || asking) return;
                                const text = input.value.trim();
                                if (!text || text === was) return end(false);
                                asking = true;
                                input.readOnly = true;
                                let why;
                                try {
                                    why = await commit(text);
                                } catch (e) {
                                    why = String(e?.message || e);
                                }
                                asking = false;
                                input.readOnly = false;
                                if (!why) return end(true, text);
                                if (stay && document.activeElement === input) {
                                    say(why, input);
                                    input.select();
                                    return;
                                }
                                end(false);
                                say(why, label, 3000);
                            };
                            input.addEventListener('input', unsay);
                            input.addEventListener('keydown', (e) => {
                                e.stopPropagation();
                                if (e.isComposing || e.keyCode === 229) return;
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    take(true);
                                } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    if (!asking) end(false);
                                }
                            });
                            input.addEventListener('blur', () => {
                                if (!asking) take(false);
                            });
                        });
                    },
                };
            },
        };
    }
);
