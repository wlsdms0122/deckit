// A mod with a band in the bar, which tells two anchors in it: OWN, given to itself, with a view bound to it, and
// OTHERS, given to another mod. On `test-anchor` it tells OWN at the rect the test names, or drops it for none; on
// `test-foreign` it binds a view to OTHERS and marks how the try ended; on `test-close` it closes its windows. It
// marks the rect it told OWN at last, and what its view is told, in turn.
const MOD = 'anchor-user';
const OWN = 'own';
const OTHERS = 'others';
const BAND = { width: 120, height: 28 };
const VIEW = { width: 320, height: 200 };
const OWN_RECT = { x: 80, y: 2, width: 32, height: 24 };
const OTHERS_RECT = { x: 8, y: 2, width: 32, height: 24 };

class AnchorUser {
    attach(shell) {
        const marks = document.documentElement.dataset;
        const labelled = (text) => shell.ui.element('div', { text, style: { padding: '6px 10px' } });
        const band = shell.windows.open({
            name: 'band',
            level: 'panel',
            edge: 'top',
            content: labelled('Band'),
            ...BAND,
        });
        const tell = (rect) => {
            band.setAnchors([
                ...(rect ? [{ id: OWN, rect, mod: MOD }] : []),
                { id: OTHERS, rect: OTHERS_RECT, mod: 'window-probe' },
            ]);
            marks.anchor = JSON.stringify(rect);
        };
        tell(OWN_RECT);
        const told = (callback) => () => (marks.told = `${marks.told || ''}${callback},`);
        const view = shell.windows.open({
            name: 'view',
            level: 'panel',
            anchor: { mod: MOD, id: OWN },
            content: labelled('View'),
            ...VIEW,
            didAppear: told('didAppear'),
            didDisappear: told('didDisappear'),
        });
        document.addEventListener('test-anchor', ({ detail: rect }) => tell(rect));
        document.addEventListener('test-foreign', () => {
            try {
                const anchor = { mod: MOD, id: OTHERS };
                shell.windows.open({ name: 'foreign', level: 'panel', anchor, content: labelled('Foreign'), ...VIEW });
                marks.foreign = 'opened';
            } catch (error) {
                marks.foreign = error.kind;
            }
        });
        document.addEventListener('test-close', () => {
            view.close();
            band.close();
        });
    }
}

module.exports = AnchorUser;
