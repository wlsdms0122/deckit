// A workspace search, in a thread of its own: a pattern can take any time to match, and the host app's process must not
// wait on it. Each file with matches is posted as it is read; `done` ends it. Lines are 1-based, columns 0-based in
// characters.
const path = require('path');
const { parentPort, workerData } = require('worker_threads');
const { readText, walk } = require('./text.js');

const { tops, query, options, limits } = workerData;

search().catch((error) => parentPort.postMessage({ type: 'error', message: error.message || String(error) }));

async function search() {
    const pattern = patternOf(query, options);
    const includes = globsOf(options.include).map(globPattern);
    const excludes = globsOf(options.exclude).map(globPattern);
    const unreadable = [];
    let total = 0;
    scan: for (const top of tops) {
        try {
            for await (const file of walk(top)) {
                const inner = path.relative(top, file);
                if (includes.length && !includes.some((glob) => glob.test(inner))) continue;
                if (excludes.some((glob) => glob.test(inner))) continue;
                const read = await readText(file, limits.fileSize);
                if (read == null) continue;
                const matches = [];
                const lines = read.text.split('\n');
                for (let index = 0; index < lines.length; index++) {
                    const line = lines[index].replace(/\r$/, '');
                    for (const match of matchesIn(pattern, line)) {
                        if (total >= limits.matches) {
                            post(file, matches, read.mtime);
                            parentPort.postMessage({ type: 'done', stoppedBy: 'limit', unreadable });
                            return;
                        }
                        matches.push({
                            line: index + 1,
                            column: match.index,
                            length: match[0].length,
                            hit: match[0],
                            text: line.length > limits.text ? line.slice(0, limits.text) : line,
                        });
                        total += 1;
                    }
                }
                post(file, matches, read.mtime);
                if (total >= limits.matches) break scan;
            }
        } catch (error) {
            unreadable.push(error.message);
        }
    }
    parentPort.postMessage({ type: 'done', stoppedBy: '', unreadable });
}

function post(file, matches, mtime) {
    if (matches.length) parentPort.postMessage({ type: 'file', path: file, matches, mtime });
}

// A match of nothing moves on by a whole character: a unicode pattern put back inside a surrogate pair would match
// the same nothing again.
function* matchesIn(pattern, line) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(line))) {
        if (match[0].length) yield match;
        else pattern.lastIndex += line.codePointAt(pattern.lastIndex) > 0xffff ? 2 : 1;
    }
}

// Unicode, as the editor's find in a file reads a pattern.
function patternOf(text, { regex = false, caseSensitive = false, word = false } = {}) {
    let source = regex ? String(text) : String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (word) source = `\\b(?:${source})\\b`;
    return new RegExp(source, caseSensitive ? 'gu' : 'giu');
}

// A plain name matches anywhere, a path with a slash from the top, and anything with * ? [ { is a glob as written.
function globsOf(text) {
    return String(text || '')
        .split(',')
        .map((part) => part.trim().replace(/^\.\//, '').replace(/\/+$/, ''))
        .filter(Boolean)
        .flatMap((part) =>
            /[*?[{]/.test(part)
                ? [part.includes('/') ? part : `**/${part}`]
                : part.includes('/')
                  ? [part, `${part}/**`]
                  : [`**/${part}`, `**/${part}/**`]
        );
}

function escaped(character) {
    return character.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

// A character at a time, so an escaped character is itself and no rule's output is read by the next.
function globPattern(glob) {
    let source = '';
    for (let index = 0; index < glob.length; index++) {
        const character = glob[index];
        if (character === '\\' && index + 1 < glob.length) source += escaped(glob[++index]);
        else if (character === '*' && glob[index + 1] === '*') {
            if (glob[index + 2] === '/') {
                source += '(?:.*/)?';
                index += 2;
            } else {
                source += '.*';
                index += 1;
            }
        } else if (character === '*') source += '[^/]*';
        else if (character === '?') source += '[^/]';
        else if (character === '[') {
            const close = glob.indexOf(']', index + 1);
            if (close < 0) {
                source += '\\[';
                continue;
            }
            source += '[' + glob.slice(index + 1, close).replace(/^!/, '^') + ']';
            index = close;
        } else if (character === '{') {
            const close = glob.indexOf('}', index + 1);
            if (close < 0) {
                source += '\\{';
                continue;
            }
            const choices = glob
                .slice(index + 1, close)
                .split(',')
                .map((choice) => globPattern(choice).source.slice(1, -1));
            source += '(?:' + choices.join('|') + ')';
            index = close;
        } else source += escaped(character);
    }
    return new RegExp('^' + source + '$');
}
