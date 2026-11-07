// The series of DECKITs under a spec folder, as each SPEC.md's head says it (spec/README.md): its number, its status
// and what it supersedes, and the cases under its conformance/.
const fs = require('fs');
const path = require('path');

const FOLDER = /^DECKIT-([1-9][0-9]*)$/;

// Every DECKIT in `spec`, by number: `{ id, status, supersedes, cases }`, `cases` each case's folder by its name.
function read(spec) {
    return fs
        .readdirSync(spec)
        .filter((name) => FOLDER.test(name) && fs.existsSync(path.join(spec, name, 'SPEC.md')))
        .map((id) => {
            const head = fs.readFileSync(path.join(spec, id, 'SPEC.md'), 'utf8').split('\n## ')[0];
            const field = (name) => new RegExp(`^${name}: *(.*)$`, 'm').exec(head)?.[1].trim() ?? '';
            const conformance = path.join(spec, id, 'conformance');
            const cases = fs.existsSync(conformance)
                ? fs
                      .readdirSync(conformance, { withFileTypes: true })
                      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
                      .map(({ name }) => [name, path.join(conformance, name)])
                : [];
            return {
                id,
                number: Number(FOLDER.exec(id)[1]),
                status: field('Status'),
                supersedes: field('Supersedes')
                    .split(',')
                    .map((one) => one.trim())
                    .filter(Boolean),
                cases: Object.fromEntries(cases),
            };
        })
        .sort((a, b) => a.number - b.number);
}

// The live set: every accepted DECKIT that no accepted DECKIT supersedes.
function live(series) {
    const accepted = series.filter(({ status }) => status === 'accepted');
    const superseded = new Set(accepted.flatMap(({ supersedes }) => supersedes));
    return accepted.filter(({ id }) => !superseded.has(id));
}

// The cases `asked` names, each a DECKIT's id or a case's name, in the series' order: `[{ deckit, name, folder }]`.
// With nothing asked, the live set's. Throws for a name that is neither.
function select(series, asked) {
    const deckits = asked.length ? [] : live(series);
    const names = new Set();
    for (const one of asked) {
        const deckit = series.find(({ id }) => id === one);
        if (deckit) deckits.push(deckit);
        else if (series.some(({ cases }) => one in cases)) names.add(one);
        else throw new Error(`${one} is no DECKIT and no case`);
    }
    const chosen = [];
    for (const deckit of series)
        for (const [name, folder] of Object.entries(deckit.cases))
            if (deckits.includes(deckit) || names.has(name)) chosen.push({ deckit, name, folder });
    return chosen;
}

module.exports = { read, live, select };
