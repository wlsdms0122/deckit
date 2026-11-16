// A mod with a band in the bar, which tells two anchors in it: OWN, given to itself, with a view bound to it, shown
// for everyone, and OTHERS, given to another mod. On `test-anchor` it tells OWN at the rect the test names, or drops it
// for none; on `test-foreign` it binds a view to OTHERS and marks how the try ended; on `test-close` it closes its
// windows. It marks the rect it told OWN at last, and what its view is told, in turn.
// On `test-seat` it closes those and opens a band alone, which tells OWN. The first press on that band opens a second
// view, MINE, under OWN, and each press after toggles it. It marks what MINE is told, in turn, and how many presses
// MINE took.
// On `test-place` it opens a third view, PLACED, at the place top-right, shown for everyone, with a button in it, and
// marks how a try at a place nobody names ended; on `test-placed-size` it asks the size the test names for it. It marks
// how many presses PLACED took.
const MOD = 'anchor-user';
const OWN = 'own';
const OTHERS = 'others';
const BAND = { width: 120, height: 28 };
const VIEW = { width: 320, height: 200 };
const PLACED = { width: 480, height: 200 };
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
            content.addEventListener('click', () => {
                if (!mine) mine = openMine();
                else mine.toggle();
            });
            band = bandOf('seat-band', content);
            tell(OWN_RECT);
            marks.seat = 'open';
        });
        let placed = null;
        document.addEventListener('test-place', () => {
            const content = shell.ui.element('div', { style: { padding: '6px 10px' } });
            content.style.minHeight = `${PLACED.height}px`;
            content.append(shell.ui.element('button', { text: 'Placed' }));
            content.addEventListener('click', () => (marks.placed = String(Number(marks.placed || 0) + 1)));
            const options = { level: 'panel', activates: false, ...PLACED };
            placed = shell.windows.open({ name: 'placed', place: 'top-right', content, ...options });
            try {
                shell.windows.open({ name: 'nowhere', place: 'middle', content: labelled('Nowhere'), ...options });
                marks.unplaced = 'opened';
            } catch (error) {
                marks.unplaced = error.kind;
            }
        });
        document.addEventListener('test-placed-size', ({ detail: { width, height } }) => placed.resize(width, height));
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
            placed?.close();
            placed = null;
            band.close();
        });
    }
}

module.exports = AnchorUser;
