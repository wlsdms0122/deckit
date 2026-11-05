const { TONES } = require('./tone.js');

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// An action a mod hands the switcher through its `setActions(actions)`, as the list reads it, or null for one with no
// label: `{ label, hint, icon, group, tone, attention, fallback, keywords, value, opens }`. Choosing one gives
// `value`, the JSON the mod knows the action by, to the mod's `run`, or with `opens` searches inside it; one with no
// value is read only. `keywords` are the words it is found by too.
function read(action) {
    if (!action || typeof action.label !== 'string' || !action.label) return null;
    const value = action.value ?? null;
    return {
        label: action.label,
        hint: text(action.hint),
        icon: text(action.icon),
        group: text(action.group),
        tone: TONES.includes(action.tone) ? action.tone : 'info',
        attention: action.attention === true,
        fallback: action.fallback === true,
        keywords: Array.isArray(action.keywords) ? action.keywords.filter((word) => typeof word === 'string') : [],
        value,
        opens: value !== null && action.opens === true,
    };
}

// An entry a mod declares to `switcher/actions` in its contributes, `{ mod, entry, token }` as the switcher is handed
// it, read as `read` reads an action, or null: choosing it runs `token`, the command the entry names, and one that
// names none is read only. A declared action has no `value` and opens nothing.
function readDeclared({ entry, token }) {
    const action = read({ ...entry, value: null, opens: false });
    return action && { ...action, token: typeof token === 'string' ? token : '' };
}

// MARK: - Private
function text(value) {
    return typeof value === 'string' ? value : '';
}

module.exports = { read, readDeclared };
