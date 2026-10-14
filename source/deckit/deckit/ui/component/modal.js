DeckitModule.define(
    'deckit/ui/component/modal',
    { uses: ['deckit/ui/overlay'], provides: ['STYLE', 'make'] },
    (OVERLAY) => {
        // MARK: - Property
        const STYLE = `
            .deckit-modal {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
                background: var(--deckit-scrim);
                font: var(--deckit-type-medium);
                transition: opacity var(--deckit-base) var(--deckit-easing);
            }
            .deckit-modal[data-align='top'] { align-items: flex-start; padding-top: 12vh; }
            .deckit-modal-card {
                box-sizing: border-box;
                max-height: 80vh;
                overflow-y: auto;
                padding: 18px 20px 16px;
                border-radius: var(--deckit-radius-card);
                border: var(--deckit-border);
                background: var(--deckit-background);
                box-shadow: var(--deckit-shadow-modal);
                color: var(--deckit-text);
                transition: transform var(--deckit-base) var(--deckit-easing);
            }
            .deckit-modal[data-bare] .deckit-modal-card { padding: 8px; }
            .deckit-modal[data-state='closed'] .deckit-modal-card { transform: translateY(6px) scale(.99); }
            .deckit-modal-title { font: 700 var(--deckit-type-heading); margin-bottom: 12px; }
            .deckit-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
        `;

        // MARK: - Initializer
        // MARK: - Public
        function make(theme, ui) {
            return { modal: (options) => modal(ui, options) };
        }

        // MARK: - Private
        // A card over the page that holds every press. `fill(card)` puts the content in and returns what takes the
        // focus. With `chrome`, a title and Cancel and confirm buttons; Enter in a text field confirms. `onKey` has a
        // key first and returns whether it took it.
        function modal(
            ui,
            {
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
                onKey: given = () => false,
                onConfirm,
                onClose,
            }
        ) {
            // Read before the callbacks run, so they see where the keyboard came from, not the button that answered.
            const before = document.activeElement;
            const scrim = document.createElement('div');
            scrim.className = 'deckit-modal';
            scrim.dataset.align = align;
            if (!chrome) scrim.dataset.bare = '';
            const card = document.createElement('div');
            card.className = 'deckit-modal-card';
            card.style.width = width;
            scrim.append(card);
            let closed = false;
            const close = () => {
                if (closed) return;
                closed = true;
                layer.close();
                if (before && before !== document.body && before.isConnected) before.focus({ preventScroll: true });
                onClose?.();
            };
            const submit = () => {
                close();
                onConfirm?.();
            };
            const confirms = chrome && confirmLabel !== null;
            const onKey = (event) => {
                if (given(event)) return true;
                if (event.key !== 'Enter' || !confirms || event.target.tagName !== 'INPUT') return false;
                submit();
                return true;
            };
            // A mod's own key listeners do not act on what is typed into a modal.
            scrim.addEventListener('keydown', (event) => event.stopPropagation());
            scrim.addEventListener('mousedown', (event) => event.target === scrim && close());

            if (chrome && title) {
                const heading = document.createElement('div');
                heading.className = 'deckit-modal-title';
                heading.textContent = title;
                card.append(heading);
            }
            const focus = fill?.(card) || null;
            const button = (label, onClick, variant = 'plain') => ui.button({ label, variant, onClick }).element;
            const cancel = button(cancelLabel, close);
            const confirm = confirms ? button(confirmLabel, submit, destructive ? 'destructive' : 'primary') : null;
            const extra = extraLabel
                ? button(extraLabel, () => {
                      close();
                      onExtra?.();
                  })
                : null;
            if (extra && destructive) extra.style.color = 'var(--deckit-alert)';
            if (chrome) {
                const actions = document.createElement('div');
                actions.className = 'deckit-modal-actions';
                actions.append(...[cancel, extra, confirm].filter(Boolean));
                card.append(actions);
            }
            const layer = OVERLAY.open({ element: scrim, modal: true, speed: 'base', onKey, onDismiss: close });
            (focus || confirm || card).focus();
            focus?.select?.();
            return { close };
        }

        return { STYLE, make };
    }
);
