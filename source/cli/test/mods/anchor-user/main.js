// A mod with a band in the bar, which tells two anchors in it: OWN, given to itself, with a view bound to it, shown
// for everyone, and OTHERS, given to another mod. On `test-anchor` it tells OWN at the rect the test names, or drops it
// for none; on `test-foreign` it binds a view to OTHERS and marks how the try ended; on `test-close` it closes its
// windows. It marks the rect it told OWN at last, and what its view is told, in turn.
// On `test-seat` it closes those and opens a band alone, which tells OWN. A press on that band left of OWN shows a second view, MINE,
// under OWN, for whoever pressed, and one on OWN toggles it. It marks what MINE is told, in turn, and how many presses
// MINE took.
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
        const bandOf = (name, content) => shell.windows.open({ name, level: 'panel', edge: 'top', content, ...BAND });
        let band = bandOf('band', labelled('Band'));
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
            activates: false,
            didAppear: told('didAppear'),
            didDisappear: told('didDisappear'),
        });
        let mine = null;
        const toldMine = (callback) => () => (marks.mine = `${marks.mine || ''}${callback},`);
        const openMine = () => {
            const content = labelled('Mine');
            content.style.minHeight = `${VIEW.height}px`;
            content.addEventListener('click', () => (marks.pressed = String(Number(marks.pressed || 0) + 1)));
            return shell.windows.open({
                name: 'mine',
                level: 'panel',
                anchor: { mod: MOD, id: OWN },
                content,
                ...VIEW,
                didAppear: toldMine('didAppear'),
                didDisappear: toldMine('didDisappear'),
            });
        };
        document.addEventListener('test-seat', () => {
            view.close();
            band.close();
            const content = labelled('Band');
            content.addEventListener('click', ({ clientX }) => {
                if (!mine) mine = openMine();
                else if (clientX < OWN_RECT.x) mine.makeKeyAndOrderFront();
                else mine.toggle();
            });
            band = bandOf('seat-band', content);
            tell(OWN_RECT);
            marks.seat = 'open';
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
            mine?.close();
            mine = null;
            band.close();
        });
    }
}

module.exports = AnchorUser;
