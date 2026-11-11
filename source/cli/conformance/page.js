// The conformance host's layer over deckit on each mod's page, a script the preload runs as it is: its lifecycle keeps
// the handle `deckit`, the frameworks' handles, and over the shell the handle `shell`, it is handed while it has
// started, and each request main hands it is
// made through the handle the call names, `deckit` where it names none, or through what an earlier call answered, as
// the mod's code makes one (spec/DECKIT-1: the input call). It keeps what
// each call answered, by the call's place, each call of the listener it hands a request, for the look heard, and the
// first value the listener was last called with, which a call that writes handed is made through, and the first value
// each call of the host's delegate was called with, which a call that writes delegated is made through.
function conformanceLayer({ channels }) {
    let handles = null; // its lifecycle's handles, `deckit`, `shell` and each framework's by its name, while it runs
    let surfaces = null; // what the web engine offers the layer over it, while its lifecycle runs, on the base web
    const shown = new Set(); // the state of each page the layer shows, while it is open: { loading }
    const told = []; // each call of a method of the delegate the host gives, { method, args }, in the order called
    const firsts = []; // the first value each call of it was called with, as the layer holds it, in the same order
    // A request through the system after a call, so that what the call sent it, an event among it, is told before the
    // call is answered: the system answers a page's requests in the order they are sent.
    const settle = () => {
        try {
            handles?.deckit.storage.records.keys();
        } catch {}
    };
    const answered = new Map(); // a call's place -> what its request answered, as the run holds it
    const heard = []; // the arguments of each call of a listener, in the order called, each as a step reads it
    let called = false; // whether the listener has been called
    let handed; // the first value the listener was last called with, as the run holds it
    const listener = (...args) => {
        heard.push(args.map((one) => (valueOf(one) === FUNCTION ? null : valueOf(one))));
        called = true;
        handed = args[0];
    };
    let changed = 0; // when a page the layer shows last told a change
    const downloading = new Set(); // the id of each download of the run under way, on the base web
    // Resolves once no page the layer shows is loading, nor has told a change for QUIET ms since `asked`, when what it
    // waits on was asked: a page asked to load tells that it is loading only after it was asked; and once no download
    // a page started is under way.
    const quiet = async (asked) => {
        if (!shown.size && !downloading.size) return;
        const busy = () =>
            [...shown].some((page) => page.loading) ||
            Date.now() - Math.max(changed, asked) < QUIET ||
            downloading.size > 0;
        while (busy()) await new Promise((resolve) => setTimeout(resolve, 10));
    };
    // The delegate the host gives a page it shows, and a page handed to it: each method `answers` names, answering
    // the value it names, each call of it kept, with its arguments read as values, for the look delegated.
    const delegateOf = (page, answers) => {
        const state = { loading: page.state.loading };
        shown.add(state);
        const delegate = {};
        for (const [method, value] of Object.entries(answers))
            delegate[method] = (...args) => {
                told.push({ method, args: args.map((one) => (valueOf(one) === FUNCTION ? null : valueOf(one))) });
                firsts.push(args[0]);
                if (method === 'openWindow' && value === true) args[0].delegate = delegateOf(args[0], answers);
                return value;
            };
        const { didChange, didClose } = delegate;
        delegate.didChange = (next) => {
            changed = Date.now();
            state.loading = next.loading;
            didChange?.(next);
        };
        delegate.didClose = () => {
            shown.delete(state);
            didClose?.();
        };
        return delegate;
    };
    channels.bind({ channel: 'conformance/heard', to: 'page', reply: true }).handle(() => ({ answers: heard }));
    channels.bind({ channel: 'conformance/delegated', to: 'page', reply: true }).handle(() => ({ answers: told }));
    // Two frames drawn of the page, or 300 ms where it draws none: what a frame follows, a region's element among it, is
    // told by then.
    const frames = () =>
        new Promise((resolve) => {
            const late = setTimeout(resolve, 300);
            requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                    clearTimeout(late);
                    resolve();
                })
            );
        });
    // Once the pages the layer shows are quiet since main asked, as after a press main handed one, and, where the page
    // is drawn, once it has drawn two frames.
    channels.bind({ channel: 'conformance/quiet', to: 'page', reply: true }).handle(async () => {
        await quiet(Date.now());
        if (document.visibilityState === 'visible') await frames();
        return {};
    });
    // A page shown in the session `session` of the lifecycle's handle `web`, at `url`, in the mod's page, which it
    // fills, or apart, with the delegate the host gives, kept by the step's place: once it is not loading.
    channels
        .bind({ channel: 'conformance/show', to: 'page', reply: true })
        .handle(async ({ step, session, url, apart, delegate }) => {
            if (!surfaces) return { none: "the host's layer is offered no web pages" };
            let page;
            try {
                const taken = handles.web.session(session);
                page = apart ? surfaces.window({ session: taken, url }) : surfaces.page({ session: taken, url });
            } catch (error) {
                return { refuses: error.stage ?? null, kind: error.kind ?? null, message: String(error.message) };
            }
            if (!apart) {
                Object.assign(page.element.style, { position: 'fixed', inset: '0' });
                document.body.append(page.element);
            }
            page.delegate = delegateOf(page, delegate);
            answered.set(step, page);
            await quiet(Date.now());
            return {};
        });
    channels.bind({ channel: 'conformance/call', to: 'page', reply: true }).handle(async (taken) => {
        const { member, args, step, of, listener: hands, handed: from, handle: named = 'deckit' } = taken;
        const at = taken.delegated ?? null;
        if (of !== null && !answered.has(of)) return { none: `step ${of} answered nothing this run holds` };
        if (from && !called) return { none: 'the listener has not been called' };
        if (at !== null && at > firsts.length) return { none: `the host's delegate was called ${firsts.length} times` };
        if (of === null && !from && at === null && !handles?.[named])
            return { none: `the lifecycle is handed no handle ${named}` };
        const start = from
            ? 'what the listener was last handed'
            : at !== null
              ? `what call ${at} of the host's delegate was handed`
              : of === null
                ? `the handle ${named}`
                : `what step ${of} answered`;
        let holder = null;
        let value = from ? handed : at !== null ? firsts[at - 1] : of === null ? handles[named] : answered.get(of);
        for (const name of member.split('.')) {
            if (value === null || (typeof value !== 'object' && typeof value !== 'function') || !(name in value))
                return { none: `${start} has no member ${member}` };
            holder = value;
            value = value[name];
        }
        const asked = Date.now();
        let came = value;
        if (typeof value === 'function') came = await value.apply(holder, hands ? [...args, listener] : args);
        else if (args.length || hands) return { none: `${member} holds a value, and is called` };
        settle();
        await quiet(asked);
        answered.set(step, came);
        if (typeof came === 'function') return {};
        const read = valueOf(came);
        return read === FUNCTION ? { none: 'what it answered holds a function' } : { answers: read };
    });
    return ({ under, deliver }) => ({
        lifecycles: [
            (under.shell ?? under.deckit).lifecycle({
                method: 'conformance',
                registrations: {},
                start: (_instance, given, scope, frameworks) => {
                    handles = { ...frameworks, deckit: given.deckit, ...(given.shell ? { shell: given.shell } : {}) };
                    // The layer over the web engine, on the base web, and not over the shell, which lays the web
                    // pages itself: it opens outside the app what a page passes on as the mod's openExternal does.
                    if (under.web && !under.shell)
                        surfaces = under.web.surfaces({
                            owner: { deliver, recordFailure: (why) => console.warn(why) },
                            open: given.deckit.openExternal,
                            scope,
                        });
                    frameworks.web?.downloads.onChange(({ id, state }) => {
                        if (state === 'downloading') downloading.add(id);
                        else downloading.delete(id);
                    });
                    scope.add(() => {
                        handles = null;
                        surfaces = null;
                        shown.clear();
                        downloading.clear();
                    });
                },
                end: () => {},
                join: () => {},
            }),
        ],
    });
}

// How long a page the layer shows tells no change before what it was asked is taken as done.
const QUIET = 300;
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
