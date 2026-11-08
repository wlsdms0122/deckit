// The conformance host's layer over deckit on each mod's page, a script the preload runs as it is: its lifecycle keeps
// the handle `deckit` it is handed while it has started, and each request main hands it is made through that handle,
// as the mod's code makes one (spec/DECKIT-1: the input call).
function conformanceLayer({ channels }) {
    let handle = null;
    channels.bind({ channel: 'conformance/call', to: 'page', reply: true }).handle(async ({ member, args }) => {
        let holder = null;
        let value = handle;
        for (const name of member.split('.')) {
            if (value === null || (typeof value !== 'object' && typeof value !== 'function') || !(name in value))
                return { none: `the handle has no member ${member}` };
            holder = value;
            value = value[name];
        }
        if (typeof value === 'function') return { answers: await value.apply(holder, args) };
        if (args.length) return { none: `${member} holds a value, and is called` };
        return { answers: value };
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
