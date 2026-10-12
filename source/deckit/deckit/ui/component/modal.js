DeckitModule.define(
    'deckit/ui/component/modal',
    {
        uses: ['deckit/ui/token', 'deckit/ui/motion', 'deckit/ui/overlay'],
        provides: ['make'],
    },
    (TOKEN, MOTION_, OVERLAY) => {
        const { MOTION } = TOKEN;
        const { play } = MOTION_;
        const { raise } = OVERLAY;

        const makeModal = (theme, ui) => {
            const textBtn = (...args) => ui.textBtn(...args);
            return ({
                title,
                confirmLabel = 'Save',
                cancelLabel = 'Cancel',
                destructive = false,
                extraLabel = null,
                onExtra = null,
                chrome = true,
                align = 'center',
                width = 'min(420px, calc(100vw - 48px))',
                fill,
                onConfirm,
                onClose,
            }) => {
                /* Read before the callbacks run, so they see where the keyboard came from, not the button
       that answered. */
                const before = document.activeElement;
                const overlay = document.createElement('div');
                const handle = {};
                const layer = raise({ close: () => close() });
                Object.assign(overlay.style, {
                    position: 'fixed',
                    inset: '0',
                    zIndex: String(layer.z),
                    display: 'flex',
                    alignItems: align === 'top' ? 'flex-start' : 'center',
                    justifyContent: 'center',
                    paddingTop: align === 'top' ? '12vh' : '0',
                    boxSizing: 'border-box',
                    background: 'rgba(0,0,0,.45)',
                    font: '14px ' + theme.font,
                    opacity: '0',
                    transition: `opacity ${MOTION.base}ms ${MOTION.easing}`,
                });
                const card = document.createElement('div');
                Object.assign(card.style, {
                    width,
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    background: theme.color.background,
                    color: theme.color.text,
                    borderRadius: '12px',
                    border: theme.border,
                    boxShadow: '0 18px 48px rgba(0,0,0,.4)',
                    padding: chrome ? '18px 20px 16px' : '8px',
                    transform: MOTION.entrance,
                    transition: `transform ${MOTION.base}ms ${MOTION.easing}`,
                });

                // Once: a second close (a handler calling close() on its way out) must not run onClose again.
                let closed = false;
                const close = () => {
                    if (closed) return;
                    closed = true;
                    layer.drop();
                    document.removeEventListener('keydown', onKey, true);
                    overlay.style.opacity = '0';
                    overlay.style.pointerEvents = 'none';
                    card.style.transform = MOTION.entrance;
                    const ms = MOTION.base;
                    if (ms) setTimeout(() => overlay.remove(), ms);
                    else overlay.remove();
                    if (before && before !== document.body && before.isConnected)
                        before.focus?.({ preventScroll: true });
                    onClose?.();
                };
                const submit = () => {
                    close();
                    onConfirm?.();
                };
                const onKey = (e) => {
                    if (e.key !== 'Escape' && e.key !== 'Enter') return;
                    if (!layer.isTop()) return; // only the top one answers
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        close();
                        return;
                    }
                    /* Captured on the document: without the standard buttons, swallowing Enter would take it from
         whoever filled the card. */
                    if (!chrome || confirmLabel === null) return;
                    e.stopPropagation();
                    if (e.target.tagName === 'INPUT') submit();
                };
                /* Kept from bubbling out of the overlay, so a plugin's own key listeners do not act on what is
       typed into a modal. */
                document.addEventListener('keydown', onKey, true);
                overlay.addEventListener('keydown', (e) => e.stopPropagation());
                overlay.addEventListener('mousedown', (e) => {
                    if (e.target === overlay) close();
                });

                if (chrome && title) {
                    const head = document.createElement('div');
                    head.textContent = title;
                    Object.assign(head.style, { font: '700 16px ' + theme.font, marginBottom: '12px' });
                    card.appendChild(head);
                }

                const focusTarget = fill?.(card) || null;

                const actions = document.createElement('div');
                Object.assign(actions.style, {
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    marginTop: '4px',
                });
                const cancel = textBtn(cancelLabel, '', close);
                const confirm =
                    confirmLabel === null
                        ? null
                        : textBtn(confirmLabel, '', submit, { variant: destructive ? 'destructive' : 'primary' });
                if (extraLabel) {
                    const extra = textBtn(extraLabel, '', () => {
                        close();
                        onExtra?.();
                    });
                    if (destructive) extra.style.color = theme.color.alert;
                    actions.append(cancel, extra, ...(confirm ? [confirm] : []));
                } else {
                    actions.append(cancel, ...(confirm ? [confirm] : []));
                }
                if (chrome) card.appendChild(actions);

                overlay.appendChild(card);
                document.body.appendChild(overlay);
                play(overlay, {}, { opacity: '1' });
                play(card, {}, { transform: 'none' });
                (focusTarget || (chrome && confirm ? confirm : card)).focus?.();
                if (focusTarget?.select) focusTarget.select();

                handle.close = close;
                return handle;
            };
        };

        return { make: (theme, ui) => ({ sheet: makeModal(theme, ui) }) };
    }
);
