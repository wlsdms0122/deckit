const { TONES } = require('./tone.js');

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// An action a mod hands the switcher through its point `actions`, as the list reads it, or null for one with no
// label: `{ label, hint, icon, group, tone, attention, fallback, keywords, key, value, opens }`. Choosing one gives
// `value`, the JSON the mod knows the action by, to the mod's `run`, or with `opens` searches inside it; one with no
// value is read only. `key` names the mod's key that does the same, `keywords` the words it is found by too.
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
        key: text(action.key),
        value,
        opens: value !== null && action.opens === true,
    };
}

// MARK: - Private
function text(value) {
    return typeof value === 'string' ? value : '';
}

module.exports = { read };
