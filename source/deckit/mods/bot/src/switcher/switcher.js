// What Bot adds to the switcher through its point `switcher:actions`: a view each, Restart Forge, Choose Forge Session,
// a search of the brain and a note of it to read, Back to the Note Before, and what is wrong with Forge now. Each
// action's value is `{ action, ...args }`, run by `does[action](args, { ready })`; one that opens a search is the value
// its results add an arg to. `modes` are the views, `{ key, label, icon, hint }`, each under the key `keyOf[key]`;
// `supervisor` answers the Now strip and `picker` and `brain` what is searched inside an action.
function switcher({ ui, modes, keyOf, supervisor, picker, brain, show, does }) {
    const brainKeywords = ['brain', 'memory', 'note', 'llmemory', '브레인', '기억', '지식', '노트'];
    let reading = null; // the search of notes under way, which a newer one stops
    return { list, now: supervisor.now, search, run };

    function list() {
        return [
            ...modes.map(({ key, label, icon, hint }) => ({
                label,
                hint: hint || '',
                icon: ui.icon(icon, { size: 16 }),
                key: keyOf[key],
                keywords: ['forge', 'workflow', 'schedule', '워크플로우', '스케줄', '스케쥴', ...brainKeywords],
                value: { action: 'show', view: key },
            })),
            ...supervisor.actions(),
            {
                label: 'Choose Forge Session',
                keywords: ['forge', 'session', 'daemon', '세션', '데몬'],
                group: 'Forge',
                opens: true,
                value: { action: 'choose-session' },
            },
            {
                label: 'Search the Brain',
                keywords: ['search', '검색', ...brainKeywords],
                group: 'Brain',
                opens: true,
                value: { action: 'search-brain' },
            },
            {
                label: 'Read a Brain Note',
                keywords: ['search', '검색', ...brainKeywords],
                group: 'Brain',
                opens: true,
                value: { action: 'read-note' },
            },
            {
                label: 'Back to the Note Before',
                key: 'brainBack',
                keywords: ['back', ...brainKeywords],
                group: 'Brain',
                value: { action: 'brain-back' },
            },
        ];
    }

    // Inside Choose Forge Session the sessions, inside Search the Brain the words as typed, inside Read a Brain Note
    // the notes found, or null where a newer search stopped this one.
    async function search(query, within) {
        if (within?.action === 'choose-session')
            return ((await picker.candidates(query)) || []).map(({ value, title, hint }) => ({
                label: title,
                hint,
                value: { ...within, session: value },
            }));
        if (within?.action === 'search-brain')
            return query ? [{ label: query, hint: 'Search the brain', value: { ...within, query } }] : [];
        if (within?.action !== 'read-note') return [];
        reading?.abort();
        const asking = (reading = new AbortController());
        const found = await brain.notesFor(query, { signal: asking.signal }).catch(() => null);
        return (
            found && found.map(({ value, title, hint }) => ({ label: title, hint, value: { ...within, note: value } }))
        );
    }

    // An action calls `ready()` once it has found it can be done, and the mod comes to the front then, so a refusal
    // is read under the switcher's list; one whose result goes on elsewhere does not call it.
    async function run({ action, ...args }) {
        await does[action](args, { ready: show });
    }
}

// The actions of `does` done with the mod in front, each ready once its synchronous part, where a refusal throws,
// is past.
function inFront(does) {
    return Object.fromEntries(
        Object.entries(does).map(([name, run]) => [
            name,
            (args, { ready }) => {
                const doing = run(args);
                ready();
                return doing;
            },
        ])
    );
}

module.exports = { switcher, inFront };
