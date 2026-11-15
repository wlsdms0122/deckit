const MODEL = require('./model/seats.js');

const STYLE = `
    .seats { padding: ${MODEL.VIEW.padding}px; box-sizing: border-box; }
    .seats-rows { display: flex; flex-direction: column; gap: ${MODEL.VIEW.gap}px; }
    .seats-ask {
        display: flex;
        align-items: center;
        gap: 6px;
        height: ${MODEL.VIEW.ask}px;
        box-sizing: border-box;
        padding: 0 4px 0 8px;
        font: var(--deckit-type-body);
        white-space: nowrap;
    }
    .seats-seat { height: ${MODEL.VIEW.seat}px; }
    .seats-seat:focus-visible { outline: 2px solid var(--deckit-focus); outline-offset: -2px; }
    .seats-name { flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; }
    .seats-says { flex: 1 1 0; overflow: hidden; text-overflow: ellipsis; color: var(--deckit-muted); }
    .seats-dot {
        flex: none;
        width: 10px;
        height: 10px;
        box-sizing: border-box;
        border: 2px solid var(--seats-colour);
        border-radius: 50%;
        background: var(--seats-colour);
    }
    .seats-seat[data-idle] .seats-dot { background: none; }
    .seats-seat[data-idle] .seats-name { color: var(--deckit-muted); }
`;

// What the mod shows while a screen stands: it reads who sits and who asks from `shell.seats` at the start and at
// each change, hands `onItem` the item as it is to stand, or null for none, and keeps the view's rows. `toggle()`
// shows the view under the mod's item in the status bar, or puts it away; `end()` stops it.
function seats(shell, { onItem }) {
    // MARK: - Property
    const { ui } = shell;
    const content = ui.element('div', { className: 'seats' });
    const drawn = new Map(); // a row's key -> the row as it is drawn now
    const filled = new Map(); // a row's key -> the row as its element was last filled with it, as text
    // A row that says what it said is left as it is, so what a reader named in it stands while others change.
    const rows = ui.list({
        key: (row) => row.key,
        create,
        update: (made, row) => filled.get(row.key) !== JSON.stringify(row) && fill(made, row),
    });
    let now = { seats: [], asks: [] }; // who sits and who asks, as last read
    let known = false; // whether they were read once
    let reads = 0; // how many times they were asked
    let greeted = null; // the id of the seat the item is labelled with now
    let timer = 0;
    let window = null; // the view's window, once it opened

    // MARK: - Initializer
    ui.addStyle(STYLE);
    content.setAttribute('role', 'group');
    content.setAttribute('aria-label', MODEL.ITEM.name);
    rows.element.classList.add('seats-rows');
    content.append(rows.element);
    const off = shell.seats.onChange(read);
    read();

    // MARK: - Public
    function toggle() {
        if (window) return window.toggle();
        window = shell.windows.open({
            name: 'seats',
            level: 'panel',
            anchor: { mod: 'status-bar', id: 'seats' },
            content,
            ...MODEL.sizeOf(MODEL.rowsOf(now)),
        });
    }

    function end() {
        off();
        clearTimeout(timer);
    }

    // MARK: - Private
    // Who sits and who asks, read anew: an answer a later read overtook is dropped. A seat that sat since the last
    // read labels the item for a while.
    async function read() {
        const turn = ++reads;
        try {
            const [seats, asks] = await Promise.all([shell.seats.list(), shell.seats.asks()]);
            if (turn !== reads) return;
            const came = known ? MODEL.cameOf(now, { seats, asks }) : null;
            now = { seats, asks };
            known = true;
            if (came !== null) greet(came);
            draw();
        } catch (error) {
            console.error('[seats] the seats are not read', error);
        }
    }

    function greet(seat) {
        greeted = seat;
        clearTimeout(timer);
        timer = setTimeout(() => {
            greeted = null;
            draw();
        }, MODEL.GREETS);
    }

    function draw() {
        onItem(MODEL.itemOf(now, greeted));
        const laid = MODEL.rowsOf(now);
        drawn.clear();
        for (const row of laid) drawn.set(row.key, row);
        for (const key of [...filled.keys()]) if (!drawn.has(key)) filled.delete(key);
        rows.set(laid);
        const size = MODEL.sizeOf(laid);
        if (laid.length) window?.resize(size.width, size.height);
    }

    function create(row) {
        const made = row.kind === 'ask' ? ui.element('div', { className: 'seats-ask' }) : seatRow(row.key);
        fill(made, row);
        return made;
    }

    // A seat's row is a button: a press, or Return or Space on it, follows its seat, or ends that where it is followed.
    function seatRow(key) {
        const made = ui.row().element;
        made.classList.add('seats-seat');
        made.setAttribute('role', 'button');
        made.tabIndex = 0;
        const press = () => {
            const row = drawn.get(key);
            if (row) acted(shell.seats.follow(row.following ? null : row.id));
        };
        made.addEventListener('click', press);
        made.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            press();
        });
        return made;
    }

    function fill(made, row) {
        filled.set(row.key, JSON.stringify(row));
        const words = [
            ui.element('span', { className: 'seats-name', text: row.name }),
            ui.element('span', { className: 'seats-says', text: row.says }),
        ];
        made.setAttribute('aria-label', row.label);
        if (row.kind === 'ask') {
            made.setAttribute('role', 'group');
            made.dataset.ask = row.id;
            made.replaceChildren(...words, answer(row, 'deny'), answer(row, 'allow'));
            return;
        }
        made.dataset.seat = row.id;
        made.toggleAttribute('data-idle', row.idle);
        made.setAttribute('aria-pressed', String(row.following));
        made.style.setProperty('--seats-colour', `var(--deckit-seat-${row.colour})`);
        made.replaceChildren(ui.element('span', { className: 'seats-dot' }), ...words);
    }

    // An answer of an ask's row, pressed for whoever sits: the shell knows the ask, not who pressed.
    function answer(row, word) {
        const made = ui.button({
            label: MODEL.ANSWERS[word],
            size: 'small',
            variant: word === 'allow' ? 'primary' : 'plain',
            onClick: () => acted(shell.seats.answer(row.id, word === 'allow')),
        }).element;
        made.setAttribute('aria-label', `${MODEL.ANSWERS[word]} ${row.name}`);
        made.dataset.answer = word;
        return made;
    }

    function acted(done) {
        done.catch((error) => console.error('[seats] not done', error));
    }

    return Object.freeze({ toggle, end });
}

module.exports = { seats };
