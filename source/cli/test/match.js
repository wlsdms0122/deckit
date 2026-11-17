// The conformance runner's matching (cli/conformance/match): a value matches strictly, a key answered with null is a
// key not answered; the stand-in in an expected string matches any run of code points within one line, the empty
// one too, never across a line's end, and the text around it still only itself; a stand-in anywhere in a table or an
// array is found. Exits 1 with a line for each check that failed.
const path = require('path');
const { same, holdsStandIn, STAND_IN: S } = require(path.join(__dirname, '..', 'conformance', 'match.js'));

const failed = [];
let count = 0;
const check = (name, ok, seen) => {
    count++;
    if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
};

const holds = [
    ['a string matches itself', 'at 1236,2 36x28', 'at 1236,2 36x28'],
    ['a key answered with null is not answered', { a: 1 }, { a: 1, b: null }],
    ['a stand-in matches a run', `at ${S},2 ${S}x28`, 'at 1225,2 47x28'],
    ['a stand-in matches the empty run', `Notes${S}`, 'Notes'],
    ['a stand-in matches a run up to a line end', `a ${S}\nb`, 'a 1 2 3\nb'],
    ['a stand-in in a table and an array', [{ text: `mark ${S}` }], [{ text: 'mark 12' }]],
    ['what a regular expression would read is matched as written', `(${S}).*`, '(7).*'],
];
for (const [name, expected, actual] of holds) check(name, same(expected, actual), actual);

const fails = [
    ['a string matches no other', 'at 1236,2 36x28', 'at 1236,2 36x29'],
    ['a stand-in matches no run across a line end', `a ${S} b`, 'a 1\n2 b'],
    ['a stand-in matches no line end alone', `a${S}b`, 'a\nb'],
    ['the text before a stand-in is strict', `at ${S}x28`, 'by 47x28'],
    ['the text after a stand-in is strict', `at ${S}x28`, 'at 47x29'],
    ['a stand-in leaves nothing after the text unmatched', `at ${S}x28`, 'at 47x28 more'],
    ['a stand-in matches no number', `${S}`, 47],
    ['a key is matched as written', { [S]: 1 }, { a: 1 }],
    ['a stand-in is no wildcard of a regular expression', `.${S}`, 'a1'],
];
for (const [name, expected, actual] of fails) check(name, !same(expected, actual), actual);

check('a stand-in is found deep in a value', holdsStandIn({ a: [1, { b: `x${S}` }] }), null);
check('no stand-in is found where none is written', !holdsStandIn({ a: ['x', 1, true] }), null);

for (const line of failed) console.log(line);
console.log(`${count - failed.length} of ${count} match checks passed`);
process.exit(failed.length ? 1 : 0);
