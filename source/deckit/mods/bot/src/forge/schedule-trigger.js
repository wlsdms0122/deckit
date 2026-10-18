const invalid = (field, message) => {
    throw Object.assign(new Error(message), { field });
};
const triggerOf = ({ kind, value, timezone, days = [] }) => {
    if (!value?.trim()) invalid('value', 'Choose a date/time or enter an interval.');
    if (kind === 'every' || kind === 'after') return { [kind]: value.trim() };
    try {
        new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
    } catch {
        invalid('timezone', 'Choose a valid timezone, for example Asia/Seoul.');
    }
    if (!timezone?.trim()) invalid('timezone', 'Enter a timezone.');
    if (kind === 'at') {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) invalid('value', 'Choose a valid time.');
        return { at: value, timezone, ...(days.length ? { days: days.join(',') } : {}) };
    }
    const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    const date = new Date(value + ':00Z');
    if (!match || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== match[1])
        invalid('value', 'Choose a valid date and time.');
    return { once: value.replace('T', ' ') + ':00', timezone };
};
const triggerSummary = (trigger) => {
    if (trigger.every) return `Every ${trigger.every}`;
    if (trigger.after) return `Once after ${trigger.after}`;
    const days = Array.isArray(trigger.days) ? trigger.days : (trigger.days || '').split(',').filter(Boolean);
    return `${trigger.once ? 'Once on ' + trigger.once : (days.length ? days.join(', ') : 'Every day') + ' at ' + trigger.at} · ${trigger.timezone || 'Local timezone'}`;
};
module.exports = { triggerOf, triggerSummary };
