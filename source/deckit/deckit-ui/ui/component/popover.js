DeckitModule.define(
    'deckit-ui/ui/component/popover',
    { uses: ['deckit-ui/ui/overlay'], provides: ['STYLE', 'make'] },
    (OVERLAY) => {
        // MARK: - Property
        const STYLE = `
            .deckit-popover {
                box-sizing: border-box;
                min-width: 230px;
                max-width: 340px;
                padding: 12px 14px;
                border-radius: var(--deckit-radius-large);
                border: var(--deckit-border);
                background: var(--deckit-background);
                box-shadow: var(--deckit-shadow-raised);
                color: var(--deckit-text);
                font: var(--deckit-type-body);
                line-height: 1.5;
            }
        `;

        // MARK: - Initializer
        // MARK: - Public
        function make() {
            return { popover };
        }

        // MARK: - Private
        // A card about an anchor: `show(anchor)` puts it under the anchor, a press elsewhere or Escape puts it away.
        function popover({ width = '', onClose } = {}) {
            const element = document.createElement('div');
            element.className = 'deckit-popover';
            if (width) element.style.maxWidth = width;
            let layer = null;
            const close = () => {
                if (!layer) return;
                layer.close();
                layer = null;
                onClose?.();
            };
            const show = (anchor) => {
                layer?.close();
                layer = OVERLAY.open({ element, anchor, gap: 6, onDismiss: close });
            };
            return { element, show, close, isOpen: () => !!layer };
        }

        return { STYLE, make };
    }
);
