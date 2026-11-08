// The conformance host's layer over deckit on each mod's page, a script the preload runs as it is: its lifecycle keeps
// the handle `deckit` it is handed while it has started, and each request main hands it is made through that handle,
// or through what an earlier call answered, as the mod's code makes one (spec/DECKIT-1: the input call). It keeps what
// each call answered, by the call's place, and each call of a listener it hands a request, for the look heard.
function conformanceLayer({ channels }) {
    let handle = null;
    // A request through the system after a call, so that what the call sent it, an event among it, is told before the
    // call is answered: the system answers a page's requests in the order they are sent.
    const settle = () => {
        try {
            handle?.storage.records.keys();
        } catch {}
    };
    const answered = new Map(); // a call's place -> what its request answered, as the run holds it
    const heard = []; // the arguments of each call of a listener, in the order called, each as a step reads it
    const listener = (...args) => {
        heard.push(args.map((one) => (valueOf(one) === FUNCTION ? null : valueOf(one))));
    };
    channels.bind({ channel: 'conformance/heard', to: 'page', reply: true }).handle(() => ({ answers: heard }));
    channels
        .bind({ channel: 'conformance/call', to: 'page', reply: true })
        .handle(async ({ member, args, step, of, listener: hands }) => {
            if (of !== null && !answered.has(of)) return { none: `step ${of} answered nothing this run holds` };
            let holder = null;
            let value = of === null ? handle : answered.get(of);
            for (const name of member.split('.')) {
                if (value === null || (typeof value !== 'object' && typeof value !== 'function') || !(name in value))
                    return {
                        none: `${of === null ? 'the handle' : `what step ${of} answered`} has no member ${member}`,
                    };
                holder = value;
                value = value[name];
            }
            let came = value;
            if (typeof value === 'function') came = await value.apply(holder, hands ? [...args, listener] : args);
            else if (args.length || hands) return { none: `${member} holds a value, and is called` };
            settle();
            answered.set(step, came);
            if (typeof came === 'function') return {};
            const read = valueOf(came);
            return read === FUNCTION ? { none: 'what it answered holds a function' } : { answers: read };
        });
    return ({ under }) => ({
        lifecycles: [
            under.lifecycle({
                method: 'conformance',
                registrations: {},
                start: (_instance, handles, scope) => {
                    handle = handles.deckit;
                    scope.add(() => (handle = null));
                },
                end: () => {},
                join: () => {},
            }),
        ],
    });
}

// What stands for a value that holds a function where a step cannot leave it out.
const FUNCTION = Symbol('function');

// `value` as a step reads it: a refusal as `{ stage, kind }`, a table without the keys bound to a function, and
// FUNCTION where a function is anywhere else in it.
function valueOf(value) {
    if (typeof value === 'function') return FUNCTION;
    if (value instanceof Error) return { stage: value.stage ?? null, kind: value.kind ?? null };
    if (Array.isArray(value)) {
        const read = value.map(valueOf);
        return read.includes(FUNCTION) ? FUNCTION : read;
    }
    if (!value || typeof value !== 'object') return value;
    const read = {};
    for (const [key, one] of Object.entries(value)) {
        if (typeof one === 'function') continue;
        read[key] = valueOf(one);
        if (read[key] === FUNCTION) return FUNCTION;
    }
    return read;
}
