DeckitModule.define(
    'deckit/service/keymap/main',
    {
        uses: [
            'deckit/config',
            'deckit/service/storage',
            'deckit/service/log/main',
            'deckit/module/chord',
            'deckit/service/plugin/identity',
            'deckit/service/plugin/host',
            'deckit/service/keymap/protocol',
        ],
        provides: ['start', 'connect', 'listen', 'register', 'chordOf'],
    },
    (CONFIG, STORAGE, LOG, CHORD, IDENTITY, HOST, PROTOCOL) => {
        // MARK: - Property
        const OVERRIDES = 'keys';
        // Keys deckit runs itself. Their owner is no plugin id: a plugin id cannot start with @.
        const OWNER = '@deckit';
        const RECORDING_MS = 20 * 1000;
        const own = []; // [{ action, key, label, scope: 'global' | 'panel', run(webContents) }]
        const scopes = new Map(); // plugin id -> [{ action, key, label, global }]
        const typing = new Set(); // webContents ids with a field focused
        const floating = new Set(); // webContents ids with something floating
        const local = new Map(); // webContents id -> [{ chord, run }], taken there before anything else
        let overrides = {};
        let recording = null; // { webContents, timer }
        let route = { pageOf: () => null, showsPanel: () => false, dismisses: () => false };

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            overrides = STORAGE.state.read(OVERRIDES, {});
            PROTOCOL.scope.on(({ keys }, sender) => {
                const plugin = IDENTITY.pluginFrom(sender);
                scopes.set(plugin.id, keys);
                IDENTITY.whenPageEnds(sender, () => scopes.get(plugin.id) === keys && scopes.delete(plugin.id));
                announce();
            });
            PROTOCOL.typing.on(({ on }, sender) => mark(typing, sender, on));
            PROTOCOL.floating.on(({ on }, sender) => mark(floating, sender, on));
            PROTOCOL.record.on(({ on }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.key-map');
                if (on) startRecording(sender);
                else if (recording?.webContents === sender) stopRecording(false);
            });
            PROTOCOL.chord.handle(({ id }) => chordOf(id));
            PROTOCOL.bindings.handle((_payload, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.key-map');
                return bindings().map(({ run, ...binding }) => binding);
            });
            PROTOCOL.bind.handle(({ id, spec }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.key-map');
                bind(id, spec);
                return true;
            });
            PROTOCOL.reset.handle(({ id }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.key-map');
                reset(id);
                return true;
            });
        }

        // Which deckit page a keystroke in a webContents belongs to, and the panel's answers: whether that page is the
        // panel on screen, and whether Escape there puts the panel away.
        function connect({ pageOf, showsPanel, dismisses }) {
            route = { pageOf, showsPanel, dismisses };
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
            const forget = () => {
                typing.delete(webContents.id);
                floating.delete(webContents.id);
            };
            webContents.once('destroyed', () => local.delete(webContents.id));
            // A reload or a crashed renderer keeps the webContents and its id, but the page's state is gone.
            LOG.guard(webContents, 'did-navigate', forget);
            LOG.guard(webContents, 'render-process-gone', forget);
            webContents.once('destroyed', forget);
        }

        // A key deckit runs itself. `global` ones work anywhere a webContents is listened to; the rest only where the
        // panel is on screen.
        function register({ action, key, label, global = false, run }) {
            own.push({ action, key, label, scope: global ? 'global' : 'panel', run });
            announce();
        }

        // The chord bound now to an id, as a person reads it.
        function chordOf(id) {
            return bindings().find((binding) => binding.id === id && binding.active)?.chord || '';
        }

        // MARK: - Private
        // What a reader needs of the binding an issue is about.
        function factsOf(binding) {
            const { id, chord, label, owner, ownerName, scope } = binding;
            return { id, chord, label, owner, ownerName, scope, deckit: owner === OWNER };
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
            const id = owner + '.' + action;
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
                // Against today's default: a change a plugin update has since made its default is no longer a change.
                changed: Object.hasOwn(overrides, id) && spec !== written,
            };
        }

        // Global first, in the order a keystroke tries them; bindings() relies on this order to pick winners. A
        // plugin's key is global only with system.global-keys.
        function catalog() {
            const plugins = HOST.plugins().filter(({ id }) => scopes.has(id));
            const global = (plugin) => plugin.permissions.some(({ id }) => id === 'system.global-keys');
            const keysOf = (plugin, wantGlobal) =>
                scopes.get(plugin.id).filter((key) => !!key.global === wantGlobal && (!wantGlobal || global(plugin)));
            return [
                ...own
                    .filter((key) => key.scope === 'global')
                    .map((key) => bindingOf(OWNER, CONFIG.name, 'global', key)),
                ...plugins.flatMap((plugin) =>
                    keysOf(plugin, true).map((key) => bindingOf(plugin.id, plugin.name, 'global', key))
                ),
                ...own.filter((key) => key.scope === 'panel').map((key) => bindingOf(OWNER, CONFIG.name, 'panel', key)),
                ...plugins.flatMap((plugin) =>
                    keysOf(plugin, false).map((key) => bindingOf(plugin.id, plugin.name, 'plugin', key))
                ),
            ];
        }

        // Two plugins' own keys never meet: only one plugin is on screen.
        function together(a, b) {
            return !(a.scope === 'plugin' && b.scope === 'plugin' && a.owner !== b.owner);
        }

        // Defaults first, then changes in the order they were made (the saved map's order), so a change landing on a
        // chord already taken is the one held back. Among defaults nothing is held back. A binding's `issues` say how a
        // keystroke is actually resolved, each { level, kind, other }: `held` (not applied, the chord is taken),
        // `shadowed` (never runs, another takes the chord first), `hides` (it hides `other` while its plugin is on
        // screen), `hidden` (not on `other`'s plugin, where the chord is `other`'s).
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
                    } else if (binding.scope === 'plugin' && other.scope === 'panel')
                        say(binding, 'warn', 'hides', other);
                    else if (binding.scope === 'panel' && other.scope === 'plugin')
                        say(binding, 'warn', 'hidden', other);
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
            for (const plugin of HOST.plugins()) {
                const view = IDENTITY.pageOf(plugin.id);
                if (view) PROTOCOL.changed.send(view, {});
            }
        }

        // First match wins, in the order bindings() lists them, resolved on every keystroke so a change applies at once.
        function handle(webContents, input) {
            if (recording) return take(input);
            if (input.type !== 'keyDown') return false;
            const own = local.get(webContents.id)?.find(({ chord }) => CHORD.matches(chord, input));
            if (own) {
                own.run();
                return true;
            }
            const view = route.pageOf(webContents);
            if (isEscape(input) && view && (floating.has(view.id) || route.dismisses(webContents))) {
                PROTOCOL.escape.send(view, { last: route.dismisses(webContents) });
                return true;
            }
            const active = bindings().filter(
                (binding) => binding.active && CHORD.matches(CHORD.parse(binding.spec), input)
            );
            const global = active.find((binding) => binding.scope === 'global');
            if (global) return run(global, webContents);
            if (!view || !route.showsPanel(webContents)) return false;
            if (typing.has(view.id) && CHORD.editsText(input)) return false;
            const plugin = IDENTITY.pluginOf(view);
            // The plugin's own first, so it wins a chord it shares with the panel.
            const hit =
                active.find((binding) => binding.scope === 'plugin' && binding.owner === plugin?.id) ||
                active.find((binding) => binding.scope === 'panel');
            return hit ? run(hit, webContents) : false;
        }

        function run(binding, webContents) {
            if (binding.owner === OWNER) {
                binding.run(webContents);
                return true;
            }
            const view = IDENTITY.pageOf(binding.owner);
            if (!view) return false;
            PROTOCOL.key.send(view, { action: binding.action });
            return true;
        }

        function isEscape(input) {
            return input.code === 'Escape' && !input.meta && !input.control && !input.alt && !input.shift;
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

        return { start, connect, listen, register, chordOf };
    }
);
