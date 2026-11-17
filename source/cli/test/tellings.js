// What the web engine's script (deckit-electron web/script.js) tells a document of its own accord, a click on a
// notification it showed and the news that its site may have notifications, is untaken from the moment it is due, a
// click before its word among it, until deckit's world in that document says `taken` of it, and none is untaken once
// the document is gone, by a new one, with its page, or as a frame's document says it goes.
// Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');
const { EventEmitter } = require('events');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const ORIGIN = 'http://127.0.0.1:1';

async function main() {
    // The script names the crypto module as main's code does.
    globalThis.require = require;
    const { createScript } = await import(url('deckit-electron', 'web', 'script.js'));
    const failed = [];
    let count = 0;
    const check = (what, ok) => {
        count++;
        if (!ok) failed.push(what);
    };
    let allowed = false;
    const SCRIPT = createScript({
        LOG: { error: () => {} },
        sessionOf: () => ({ mod: 'mod-a', name: 'main' }),
        permits: () => allowed,
        permitted: () => [],
        notified: () => true,
        request: async () => true,
        readClipboard: async () => null,
        writeClipboard: async () => false,
    });
    const page = Object.assign(new EventEmitter(), { id: 1, run: () => {}, getURL: () => ORIGIN + '/' });
    const { heard } = SCRIPT.attach({}, page, () => {});
    const answers = [];
    const frame = { origin: ORIGIN, main: true, answer: (body) => answers.push(body && JSON.parse(body)) };
    const said = (message) => heard(JSON.stringify(message), frame);

    said({ op: 'show', id: 1, title: 't', body: '', silent: false });
    const notification = answers.at(-1).answer;
    said({ op: 'click', id: 2, notification });
    check('nothing is untaken before a click', SCRIPT.untaken() === 0);
    SCRIPT.clickNotification(page, notification);
    const click = answers.at(-1);
    check('a click is told its word', click.id === 2 && click.answer === true && click.told > 0);
    check('a click told is untaken', SCRIPT.untaken() === 1);
    said({ op: 'taken', told: click.told });
    check('a click is taken once its document says so', SCRIPT.untaken() === 0);

    said({ op: 'show', id: 6, title: 't', body: '', silent: false });
    const early = answers.at(-1).answer;
    SCRIPT.clickNotification(page, early);
    check('a click before its word is untaken', SCRIPT.untaken() === 1);
    said({ op: 'click', id: 7, notification: early });
    const told = answers.at(-1);
    check('a click before its word is told as the word comes', told.id === 7 && told.told > click.told);
    said({ op: 'taken', told: told.told });
    check('a click before its word is taken once its document says so', SCRIPT.untaken() === 0);

    // A frame's document goes, by another or as the frame is removed, and says so; the main frame's stays.
    const sub = { origin: ORIGIN, main: false, answer: (body) => answers.push(body && JSON.parse(body)) };
    const inFrame = (message) => heard(JSON.stringify({ ...message, document: 'framed' }), sub);
    inFrame({ op: 'show', id: 8, title: 't', body: '', silent: false });
    const framed = answers.at(-1).answer;
    inFrame({ op: 'click', id: 9, notification: framed });
    said({ op: 'show', id: 10, title: 't', body: '', silent: false });
    const kept = answers.at(-1).answer;
    SCRIPT.clickNotification(page, kept);
    SCRIPT.clickNotification(page, framed);
    check("a click told in a frame is untaken with the main frame's", SCRIPT.untaken() === 2);
    inFrame({ op: 'gone' });
    check('a document of a frame that goes takes its own', SCRIPT.untaken() === 1);
    said({ op: 'click', id: 11, notification: kept });
    said({ op: 'taken', told: answers.at(-1).told });
    check("the main frame's is taken as it says so", SCRIPT.untaken() === 0);
    inFrame({ op: 'show', id: 12, title: 't', body: '', silent: false });
    const lost = answers.at(-1).answer;
    inFrame({ op: 'gone' });
    SCRIPT.clickNotification(page, lost);
    check('a notification of a document gone is clicked to none', SCRIPT.untaken() === 0);

    said({ op: 'news', id: 3 });
    check('news that waits is told nothing', SCRIPT.untaken() === 0);
    allowed = true;
    SCRIPT.permissionsChanged();
    const news = answers.at(-1);
    check('the news is told its word', news.id === 3 && news.answer === 'granted' && news.told > told.told);
    check('the news told is untaken', SCRIPT.untaken() === 1);
    page.emit('committed');
    check('a new document leaves none untaken', SCRIPT.untaken() === 0);

    said({ op: 'show', id: 4, title: 't', body: '', silent: false });
    said({ op: 'click', id: 5, notification: answers.at(-1).answer });
    SCRIPT.clickNotification(page, answers.at(-1).answer);
    check('a click before the page closes is untaken', SCRIPT.untaken() === 1);
    page.emit('destroyed');
    check('a page closed leaves none untaken', SCRIPT.untaken() === 0);

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} telling checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
