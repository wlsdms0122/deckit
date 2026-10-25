const { TONES } = require('./tone.js');

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A row a mod hands the switcher through its point `switcher:rows`, as the list reads it, or null for one with no
// label: `{ label, hint, icon, group, tone, attention, fallback, reference, completes }`. A row runs a command of
// `mod`, the mod whose extension handed it, by the reference in its `run`, `{ command, args }`, or opens a list to
// fill an arg of one by `completes`, `{ command, args, param }`; one with neither is read only. A reference is
// `{ provider, command, args }` with `mod` as its provider, so a row runs none but its own mod's commands.
function read(mod, row) {
    if (!row || typeof row.label !== 'string' || !row.label) return null;
    const reference = referenceOf(mod, row.run);
    const completes = reference ? null : referenceOf(mod, row.completes);
    return {
        label: row.label,
        hint: text(row.hint),
        icon: text(row.icon),
        group: text(row.group),
        tone: TONES.includes(row.tone) ? row.tone : 'info',
        attention: row.attention === true,
        fallback: row.fallback === true,
        reference,
        completes:
            completes && typeof row.completes.param === 'string' ? { ...completes, param: row.completes.param } : null,
    };
}

// MARK: - Private
function referenceOf(mod, given) {
    if (typeof given?.command !== 'string') return null;
    const args = given.args && typeof given.args === 'object' ? given.args : {};
    return { provider: mod, command: given.command, args };
}

function text(value) {
    return typeof value === 'string' ? value : '';
}

module.exports = { read };
