DeckitModule.define(
    'deckit/service/keymap/main',
    {
        uses: [
            'deckit/config',
            'deck/service/storage',
            'deck/service/log/main',
            'deckit/module/chord',
            'deck/service/deck/identity',
            'deck/service/deck/catalog',
            'deck/service/deck/runner',
            'deckit/service/keymap/protocol',
            'deckit/service/keymap/model/binding-id',
            'deckit/service/keymap/model/permission',
        ],
        provides: ['start', 'connect', 'delegate', 'listen', 'register', 'chordOf'],
    },
    (CONFIG, STORAGE, LOG, CHORD, IDENTITY, CATALOG, RUNNER, PROTOCOL, BINDING_ID, KEYMAP_PERMISSION) => {
        // MARK: - Property
        const OVERRIDES = 'keys';
        const RECORDING_MS = 20 * 1000;
        const own = []; // [{ action, key, label, scope: 'global' | 'shell', run(webContents) }]
        const scopes = new Map(); // mod id -> [{ action, key, label, global }]
        const typing = new Set(); // webContents ids with a field focused
        const local = new Map(); // webContents id -> [{ chord, run }], taken there before anything else
        let overrides = {};
        let recording = null; // { webContents, timer }
        let pageFor = () => null;
        let delegated = { isActive: () => false, monitor: () => false };

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            overrides = STORAGE.state.read(OVERRIDES, {});
            PROTOCOL.scope.on(({ keys }, sender) => {
                const mod = IDENTITY.modFrom(sender);
                const taken = keys.filter((key) => takes(mod, key));
                scopes.set(mod.id, taken);
                IDENTITY.whenPageEnds(sender, () => scopes.get(mod.id) === taken && scopes.delete(mod.id));
                announce();
            });
            // A run that has ended takes no key, though its page may stay until the mod launches again.
            RUNNER.observe('didTerminate', ({ mod }) => scopes.delete(mod.id) && announce());
            PROTOCOL.typing.on(({ on }, sender) => mark(typing, sender, on));
            PROTOCOL.record.on(({ on }, sender) => {
                IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEY_MAP);
                if (on) startRecording(sender);
                else if (recording?.webContents === sender) stopRecording(false);
            });
            PROTOCOL.chord.handle(({ id }) => chordOf(id));
            PROTOCOL.bindings.handle((_payload, sender) => {
                IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEY_MAP);
                return bindings().map(({ run, ...binding }) => binding);
            });
            PROTOCOL.bind.handle(({ id, spec }, sender) => {
                IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEY_MAP);
                bind(id, spec);
                return true;
            });
            PROTOCOL.reset.handle(({ id }, sender) => {
                IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEY_MAP);
                reset(id);
                return true;
            });
        }

        // Which deckit page a keystroke in a webContents belongs to.
        function connect({ pageFor: of }) {
            pageFor = of;
        }

        // What the key map asks the shell of a deckit page a keystroke landed in: `isActive(page)`, whether it is the
        // page in front, where the mod's own keys and the shell's run; `monitor(page, input)`, the shell's look at the
        // keystroke before any binding, taking it by answering true.
        function delegate({ isActive, monitor }) {
            delegated = { isActive, monitor };
        }

        // Keystrokes in this webContents go through the key map. deckit listens on its own; an app hands its own
        // where deckit's global keys should work too. `keys` are this webContents' own, taken there first: only a
        // chord main catches wins over a meaning the app's menu gives it.
        function listen(webContents, { keys = [] } = {}) {
            if (keys.length)
                local.set(
                    webContents.id,
                    keys.map(({ key, run }) => ({ chord: CHORD.parse(key), run }))
                );
            LOG.guard(webContents, 'before-input-event', (event, input) => {
                if (handle(webContents, input)) event.preventDefault();
            });
            const forget = () => typing.delete(webContents.id);
            webContents.once('destroyed', () => local.delete(webContents.id));
            // A reload or a crashed renderer keeps the webContents and its id, but the page's state is gone.
            LOG.guard(webContents, 'did-navigate', forget);
            LOG.guard(webContents, 'render-process-gone', forget);
            webContents.once('destroyed', forget);
        }

        // A key the shell runs itself. `global` ones work anywhere a webContents is listened to; the rest only in the
        // page in front. Answers its id, for chordOf.
        function register({ action, key, label, global = false, run }) {
            own.push({ action, key, label, scope: global ? 'global' : 'shell', run });
            announce();
            return BINDING_ID.idOf(BINDING_ID.SHELL_OWNER, action);
        }

        // The chord bound now to an id, as a person reads it.
        function chordOf(id) {
            return bindings().find((binding) => binding.id === id && binding.active)?.chord || '';
        }

        // MARK: - Private
        // What a page declares is held to the rule here, where it is taken: a global key needs ⌘, ⌃ or ⌥, and none a
        // text field uses, since it is taken from every page, fields included.
        function takes(mod, key) {
            const { action, key: spec, label, global } = key || {};
            if (typeof action !== 'string' || typeof spec !== 'string' || typeof label !== 'string') return false;
            if (typeof global !== 'boolean' || CHORD.normalize(spec) !== spec) return false;
            if (!global) return true;
            const chord = CHORD.parse(spec);
            const fits = (chord.meta || chord.ctrl || chord.alt) && !CHORD.editsText({ ...chord, control: chord.ctrl });
            if (!fits) LOG.warn(`${mod.id}: key "${action}" cannot be global, so it is not taken`);
            return !!fits;
        }

        // What a reader needs of the binding an issue is about.
        function factsOf(binding) {
            const { id, chord, label, owner, ownerName, scope } = binding;
            return { id, chord, label, owner, ownerName, scope, shell: owner === BINDING_ID.SHELL_OWNER };
        }

        function mark(set, sender, on) {
            if (on) set.add(sender.id);
            else set.delete(sender.id);
        }

        function effective(id, key) {
            const spec = Object.hasOwn(overrides, id) ? overrides[id] : key;
            return spec ? CHORD.normalize(spec) : null;
        }

        function bindingOf(owner, ownerName, scope, { action, key, label, run }) {
            const id = BINDING_ID.idOf(owner, action);
            const written = CHORD.normalize(key);
            const spec = effective(id, written);
            return {
                id,
                owner,
                ownerName,
                scope,
                action,
                label,
                key: written,
                spec,
                run,
                chord: spec ? CHORD.label(spec) : '',
                defaultChord: written ? CHORD.label(written) : '',
                // Against today's default: a change a mod update has since made its default is no longer a change.
                changed: Object.hasOwn(overrides, id) && spec !== written,
            };
        }

        // Global first, in the order a keystroke tries them; bindings() relies on this order to pick winners. A
        // mod's key is global only with system.global-keys.
        function catalog() {
            const mods = CATALOG.mods().filter(({ id }) => scopes.has(id));
            const global = (mod) => mod.permissions.some(({ id }) => id === KEYMAP_PERMISSION.GLOBAL_KEYS);
            const keysOf = (mod, wantGlobal) =>
                scopes.get(mod.id).filter((key) => !!key.global === wantGlobal && (!wantGlobal || global(mod)));
            return [
                ...own
                    .filter((key) => key.scope === 'global')
                    .map((key) => bindingOf(BINDING_ID.SHELL_OWNER, CONFIG.name, 'global', key)),
                ...mods.flatMap((mod) => keysOf(mod, true).map((key) => bindingOf(mod.id, mod.name, 'global', key))),
                ...own
                    .filter((key) => key.scope === 'shell')
                    .map((key) => bindingOf(BINDING_ID.SHELL_OWNER, CONFIG.name, 'shell', key)),
                ...mods.flatMap((mod) => keysOf(mod, false).map((key) => bindingOf(mod.id, mod.name, 'mod', key))),
            ];
        }

        // Two mods' own keys never meet: each runs only in its own mod's page.
        function together(a, b) {
            return !(a.scope === 'mod' && b.scope === 'mod' && a.owner !== b.owner);
        }

        // Defaults first, then changes in the order they were made (the saved map's order), so a change landing on a
        // chord already taken is the one held back. Among defaults nothing is held back. A binding's `issues` say how a
        // keystroke is actually resolved, each { level, kind, other }: `held` (not applied, the chord is taken),
        // `shadowed` (never runs, another takes the chord first), `hides` (it hides `other` in its mod's page),
        // `hidden` (not in `other`'s mod's page, where the chord is `other`'s).
        function bindings() {
            const list = catalog();
            const order = Object.keys(overrides);
            const rank = (binding) => (binding.changed ? order.indexOf(binding.id) : -1);
            const at = new Map(list.map((binding, index) => [binding.id, index]));
            const issues = new Map(list.map((binding) => [binding.id, []]));
            const say = (binding, level, kind, other) =>
                issues.get(binding.id).push({ level, kind, other: factsOf(other) });
            const held = new Set();
            const accepted = [];
            for (const binding of [...list].sort((a, b) => rank(a) - rank(b) || at.get(a.id) - at.get(b.id))) {
                if (!binding.spec) continue;
                const taken = accepted.find((other) => other.spec === binding.spec && together(other, binding));
                if (taken && binding.changed) {
                    held.add(binding.id);
                    say(binding, 'error', 'held', taken);
                    continue;
                }
                accepted.push(binding);
            }
            for (const binding of accepted) {
                for (const other of accepted) {
                    if (other === binding || other.spec !== binding.spec || !together(other, binding)) continue;
                    const earlier = at.get(other.id) < at.get(binding.id);
                    if (other.scope === 'global' && binding.scope !== 'global')
                        say(binding, 'error', 'shadowed', other);
                    else if (binding.scope === 'global' && other.scope === 'global' && earlier)
                        say(binding, 'error', 'shadowed', other);
                    else if (
                        binding.scope !== 'global' &&
                        other.owner === binding.owner &&
                        other.scope === binding.scope &&
                        earlier
                    ) {
                        say(binding, 'error', 'shadowed', other);
                    } else if (binding.scope === 'mod' && other.scope === 'shell') say(binding, 'warn', 'hides', other);
                    else if (binding.scope === 'shell' && other.scope === 'mod') say(binding, 'warn', 'hidden', other);
                }
            }
            return list.map((binding) => ({
                ...binding,
                active: !!binding.spec && !held.has(binding.id),
                issues: issues.get(binding.id),
            }));
        }

        // Deleted and added again, so the saved map keeps the order changes were made in, which bindings() relies on.
        function bind(id, spec) {
            const binding = bindings().find((candidate) => candidate.id === id);
            if (!binding) throw new Error('no such shortcut: ' + id);
            const wanted = spec ? CHORD.normalize(spec) : '';
            if (spec && !wanted) throw new Error('not a chord: ' + spec);
            const next = { ...overrides };
            delete next[id];
            if (wanted !== binding.key) next[id] = wanted;
            save(next);
        }

        function reset(id) {
            if (!Object.hasOwn(overrides, id)) return;
            const next = { ...overrides };
            delete next[id];
            save(next);
        }

        function save(next) {
            overrides = next;
            STORAGE.state.write(OVERRIDES, overrides);
            announce();
        }

        function announce() {
            for (const mod of CATALOG.mods()) {
                const view = IDENTITY.pageOf(mod.id);
                if (view) PROTOCOL.changed.send(view, {});
            }
        }

        // First match wins, in the order bindings() lists them, resolved on every keystroke so a change applies at
        // once.
        function handle(webContents, input) {
            if (recording) return take(input);
            if (input.type !== 'keyDown') return false;
            const own = local.get(webContents.id)?.find(({ chord }) => CHORD.matches(chord, input));
            if (own) {
                own.run();
                return true;
            }
            const page = pageFor(webContents);
            if (page && delegated.monitor(page, input)) return true;
            const active = bindings().filter(
                (binding) => binding.active && CHORD.matches(CHORD.parse(binding.spec), input)
            );
            const global = active.find((binding) => binding.scope === 'global');
            if (global) return run(global, webContents);
            if (!page || !delegated.isActive(page)) return false;
            if (typing.has(page.id) && CHORD.editsText(input)) return false;
            const mod = IDENTITY.modOf(page);
            // The mod's own first, so it wins a chord it shares with the shell.
            const hit =
                active.find((binding) => binding.scope === 'mod' && binding.owner === mod?.id) ||
                active.find((binding) => binding.scope === 'shell');
            return hit ? run(hit, webContents) : false;
        }

        function run(binding, webContents) {
            if (binding.owner === BINDING_ID.SHELL_OWNER) {
                binding.run(webContents);
                return true;
            }
            const view = IDENTITY.pageOf(binding.owner);
            if (!view) return false;
            PROTOCOL.key.send(view, { action: binding.action });
            return true;
        }

        // Recording happens here: a page never hears a chord already bound, and the app menu would act on
        // Command-W while a person types it into a field. It ends when the asking page goes.
        function startRecording(webContents) {
            stopRecording(false);
            const end = () => recording?.webContents === webContents && stopRecording(true);
            const drop = IDENTITY.whenPageEnds(webContents, end);
            recording = { webContents, drop, timer: setTimeout(end, RECORDING_MS) };
        }

        function stopRecording(tell) {
            if (!recording) return;
            const { webContents, drop, timer } = recording;
            clearTimeout(timer);
            drop();
            recording = null;
            if (tell) PROTOCOL.recorded.send(webContents, { cancel: true });
        }

        function take(input) {
            if (input.type !== 'keyDown') return true;
            const keys = {
                code: input.code,
                meta: input.meta,
                control: input.control,
                shift: input.shift,
                alt: input.alt,
            };
            const { webContents } = recording;
            if (CHORD.endsRecording(keys)) stopRecording(false);
            PROTOCOL.recorded.send(webContents, keys);
            return true;
        }

        return { start, connect, delegate, listen, register, chordOf };
    }
);
