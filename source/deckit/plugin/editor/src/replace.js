const { nameOf } = require('./path.js');

function expandReplacement(replacement, match) {
    return replacement.replace(/\$(\$|&|<([^>]*)>|(\d{1,2}))/g, (whole, token, name, digits) => {
        if (token === '$') return '$';
        if (token === '&') return match[0];
        if (name !== undefined) return match.groups?.[name] ?? '';
        const group = Number(digits);
        return group > 0 && group < match.length ? (match[group] ?? '') : whole;
    });
}

// The edits that replace `matches`, with `lineOf(number)` giving a line's { from, text }. Only the matches the search
// reported are replaced, at their line and column, and only if the text there is unchanged.
function planReplace(lineOf, matches, { query, replacement, options = {} }) {
    const usesGroups = options.regex && replacement.includes('$');
    const stickyPattern = usesGroups ? stickyPatternOf(query, options) : null;
    const edits = [];
    let skipped = 0;
    let reason = '';
    const skip = (why) => {
        skipped += 1;
        reason = reason || why;
    };
    for (const match of matches) {
        const line = lineOf(match.line);
        if (!line || line.text.slice(match.column, match.column + match.length) !== match.hit) {
            skip('the text there changed after the search');
            continue;
        }
        let insert = replacement;
        if (usesGroups) {
            stickyPattern.lastIndex = match.column;
            const found = stickyPattern.exec(line.text);
            if (!found || found[0] !== match.hit) {
                skip('the pattern did not match there the same way');
                continue;
            }
            insert = expandReplacement(replacement, found);
        }
        edits.push({ from: line.from + match.column, to: line.from + match.column + match.length, insert });
    }
    return { edits, skipped, reason };
}

// The search's own pattern, word bounds included, held at a column.
function stickyPatternOf(query, { regex = false, caseSensitive = false, word = false }) {
    let source = regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (word) source = `\\b(?:${source})\\b`;
    return new RegExp(source, caseSensitive ? 'uy' : 'iuy');
}

function linesOfText(text) {
    const starts = [0];
    for (let index = 0; index < text.length; index++) if (text.charCodeAt(index) === 10) starts.push(index + 1);
    return (number) => {
        if (number < 1 || number > starts.length) return null;
        const end = number < starts.length ? starts[number] - 1 : text.length;
        return { from: starts[number - 1], text: text.slice(starts[number - 1], end).replace(/\r$/, '') };
    };
}

// From the end, so earlier offsets stay valid.
function applyEdits(text, edits) {
    return [...edits]
        .sort((left, right) => right.from - left.from)
        .reduce((result, edit) => result.slice(0, edit.from) + edit.insert + result.slice(edit.to), text);
}

// Replaces the search's `results`. An open file is changed in its editor and saved, and left out while it has unsaved
// changes: its lines may not be the ones the search read. A replacement counts once it is on disk, which is what the
// count tells the person.
async function replaceMatches({ results, query, replacement, options, fileAt, isDirty, save, writeUnopened }) {
    let replaced = 0;
    let skipped = 0;
    let reason = '';
    const count = (plan) => {
        replaced += plan.edits.length;
        skipped += plan.skipped;
        reason = reason || plan.reason;
    };
    const skip = (number, why) => {
        skipped += number;
        reason = reason || why;
    };
    for (const { path, matches, mtime } of results) {
        const file = fileAt(path);
        if (file) {
            if (isDirty(file)) {
                skip(matches.length, `${nameOf(path)} has unsaved changes`);
                continue;
            }
            if (mtime && Math.abs(file.mtime - mtime) > 1) {
                skip(matches.length, `${nameOf(path)} changed after the search`);
                continue;
            }
            const content = file.view.state.doc;
            const lineOf = (number) => (number >= 1 && number <= content.lines ? content.line(number) : null);
            const plan = planReplace(lineOf, matches, { query, replacement, options });
            if (!plan.edits.length) {
                count(plan);
                continue;
            }
            file.view.dispatch({ changes: plan.edits });
            if (await save(file)) count(plan);
            else skip(matches.length, `${nameOf(path)} could not be saved`);
            continue;
        }
        try {
            let plan = null;
            await writeUnopened(path, mtime, (text) => {
                plan = planReplace(linesOfText(text), matches, { query, replacement, options });
                return plan.edits.length ? applyEdits(text, plan.edits) : null;
            });
            count(plan);
        } catch (error) {
            skip(
                matches.length,
                error.kind === 'CHANGED'
                    ? `${nameOf(path)} changed after the search`
                    : `${nameOf(path)} could not be changed (${error.message})`
            );
        }
    }
    return { replaced, skipped, reason };
}

module.exports = { replaceMatches };
