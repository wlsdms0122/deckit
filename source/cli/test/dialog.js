// A page's dialog as deckit keeps it (deckit-shell/deckit/dialog), over stand-ins for the environment's pages, which
// pages are whose and the mods' names: refused at once before it is served, for a mod's own page, for a page that runs
// no mod, for a page that is no mod's, and for a page with a dialog up; handed up with who asks, the site's origin of a
// web page and the mod's name of any other; answered once by the first answer, of its kind; refused as asked; and
// withdrawn and refused as its page closes, loads another document, or its process ends; and a page's picker, handed
// up with what its kind holds and its rect, replied an option's index, a date or a colour, withdrawn as its page asks
// again.
// Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const { createDialog } = await import(url('deckit-shell', 'deckit', 'dialog', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const modPage = { name: "notes' own page" };
    const shellPage = { name: 'the desktop' };
    const content = { name: "a window's content of notes" };
    const site = { name: 'a web page notes shows' };
    const stray = { name: 'a page of no mod' };
    const IDENTITY = {
        modOf: (page) => (page === modPage ? { id: 'notes' } : null),
        pageNameOf: (page) => (page === shellPage ? 'desktop' : null),
    };
    const CATALOG = { mods: () => [{ id: 'notes', manifest: { name: 'Notes' } }] };
    let answer = null;
    const watching = new Map(); // page -> what watches it
    const pages = {
        dialogs: (given) => (answer = given),
        watch: (page, watchers) => {
            watching.set(page, watchers);
            return () => watching.get(page) === watchers && watching.delete(page);
        },
    };
    const DIALOG = createDialog({ IDENTITY, CATALOG, pages });
    DIALOG.start();
    const question = (kind, extra = {}) => ({
        kind,
        message: 'Sure?',
        value: '',
        origin: 'deckit://notes.mod',
        ...extra,
    });

    check('the one answer is given as deckit starts', typeof answer === 'function', typeof answer);
    check(
        'a dialog before the dialogs are served is refused at once',
        answer(content, question('confirm')) === undefined,
        ''
    );

    const asked = [];
    const withdrawn = [];
    const owners = new Map([
        [content, { mod: 'notes', web: false }],
        [site, { mod: 'notes', web: true }],
    ]);
    const served = DIALOG.serve({
        whose: (page) => owners.get(page) ?? null,
        asked: (dialog) => asked.push(dialog),
        withdrawn: (ask) => withdrawn.push(ask),
    });
    check(
        "a mod's own page, a page that runs no mod and a page that is no mod's are refused at once, told nothing",
        answer(modPage, question('alert')) === undefined &&
            answer(shellPage, question('confirm')) === undefined &&
            answer(stray, question('prompt')) === undefined &&
            asked.length === 0,
        asked
    );

    const confirmed = answer(content, question('confirm'));
    const second = answer(content, question('alert'));
    check(
        "a dialog is handed up with the mod's name, and a second of the same page is refused at once",
        confirmed instanceof Promise &&
            second === undefined &&
            asked.length === 1 &&
            JSON.stringify(asked[0]) ===
                JSON.stringify({
                    ask: asked[0].ask,
                    page: content,
                    kind: 'confirm',
                    message: 'Sure?',
                    value: '',
                    from: 'Notes',
                }),
        asked
    );
    const prompted = answer(site, question('prompt', { value: 'start', origin: 'https://a.com' }));
    check(
        "a web page's dialog names the site's origin",
        asked.length === 2 && asked[1].from === 'https://a.com' && asked[1].value === 'start',
        asked[1]
    );
    served.answer(asked[0].ask, 'yes');
    served.answer(asked[0].ask, true);
    served.answer(asked[1].ask, 'typed');
    served.answer(asked[1].ask, 'again');
    check(
        'the first answer is the reply, of its kind, a later one doing nothing, and each is told no longer up',
        (await confirmed) === undefined &&
            (await prompted) === 'typed' &&
            JSON.stringify(withdrawn) === JSON.stringify([asked[0].ask, asked[1].ask]) &&
            watching.size === 0,
        { withdrawn, watching: watching.size }
    );

    const refused = answer(content, question('leave'));
    served.refuse(asked[2].ask);
    served.answer(asked[2].ask, false);
    check('a dialog refused is replied the refusal, a later answer doing nothing', (await refused) === undefined, '');

    for (const event of ['destroyed', 'ended', 'gone']) {
        const pending = answer(content, question('confirm'));
        const ask = asked[asked.length - 1].ask;
        watching.get(content)[event]();
        served.answer(ask, true);
        check(
            `a dialog is withdrawn and refused as its page is ${event}`,
            (await pending) === undefined && withdrawn[withdrawn.length - 1] === ask && watching.size === 0,
            withdrawn
        );
    }
    const again = answer(content, question('confirm'));
    served.answer(asked[asked.length - 1].ask, true);
    check('a page asks again once its dialog is no longer up', (await again) === true, '');

    const options = [{ label: 'Apple', group: null, disabled: false, selected: true }];
    const rect = { x: 20, y: 100, width: 200, height: 30 };
    const picked = answer(content, { kind: 'select', name: 'Fruit', options, rect, origin: 'deckit://notes.mod' });
    const pick = asked[asked.length - 1];
    check(
        'a picker is handed up with its name, options and rect',
        JSON.stringify(pick) ===
            JSON.stringify({
                ask: pick.ask,
                page: content,
                kind: 'select',
                name: 'Fruit',
                options,
                rect,
                from: 'Notes',
            }),
        pick
    );
    served.answer(pick.ask, 'Apple');
    check("a picker is replied an option's index alone", (await picked) === undefined, '');
    const first = answer(content, { kind: 'select', options, rect });
    const firstAsk = asked[asked.length - 1].ask;
    const later = answer(content, question('confirm'));
    served.answer(asked[asked.length - 1].ask, true);
    check(
        'a picker up is withdrawn as its page asks again, and the next is handed up',
        (await first) === undefined && withdrawn.includes(firstAsk) && (await later) === true,
        withdrawn
    );
    const kept = answer(content, question('confirm'));
    const keptAsk = asked[asked.length - 1].ask;
    const behind = answer(content, { kind: 'select', options, rect });
    served.answer(keptAsk, true);
    check('a dialog up refuses a picker its page asks', behind === undefined && (await kept) === true, '');
    const chosen = answer(content, { kind: 'select', options, rect });
    served.answer(asked[asked.length - 1].ask, 0);
    check('a picker is replied the index picked', (await chosen) === 0, '');
    const control = { type: 'date', value: '2026-03-14', min: '', max: '2026-03-20', step: '' };
    const dated = answer(content, { kind: 'date', name: 'Day', ...control, rect, origin: 'deckit://notes.mod' });
    const day = asked[asked.length - 1];
    const { ask: _ask, page: _page, ...handed } = day;
    served.answer(day.ask, '2026-03-20');
    check(
        'a date picker is handed up with its control and replied a date',
        JSON.stringify(handed) === JSON.stringify({ kind: 'date', name: 'Day', ...control, rect, from: 'Notes' }) &&
            (await dated) === '2026-03-20',
        handed
    );
    const undated = answer(content, { kind: 'date', ...control, rect });
    served.answer(asked[asked.length - 1].ask, 14);
    check('a date picker is replied a date alone', (await undated) === undefined, '');
    const coloured = answer(content, { kind: 'color', name: 'Colour', value: '#010203', rect });
    const colour = asked[asked.length - 1];
    served.answer(colour.ask, '#a0b0c0');
    const named = answer(content, { kind: 'color', name: 'Colour', value: '#010203', rect });
    served.answer(asked[asked.length - 1].ask, 'red');
    check(
        'a colour picker is handed up with its value and replied a colour alone',
        colour.value === '#010203' && (await coloured) === '#a0b0c0' && (await named) === undefined,
        colour
    );
    await tick();

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} dialog checks`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
