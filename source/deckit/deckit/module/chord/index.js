DeckitModule.define(
    'deckit/module/chord',
    {
        uses: [],
        provides: [
            'parse',
            'normalize',
            'label',
            'matches',
            'fromEvent',
            'editsText',
            'record',
            'cancels',
            'clears',
            'endsRecording',
        ],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // A key's name in a spec, by its physical code.
        const CODES = {
            left: 'ArrowLeft',
            right: 'ArrowRight',
            up: 'ArrowUp',
            down: 'ArrowDown',
            enter: 'Enter',
            escape: 'Escape',
            space: 'Space',
            tab: 'Tab',
            backspace: 'Backspace',
            delete: 'Delete',
            '[': 'BracketLeft',
            ']': 'BracketRight',
            ',': 'Comma',
            '.': 'Period',
            '/': 'Slash',
            '\\': 'Backslash',
            '-': 'Minus',
            '=': 'Equal',
            ';': 'Semicolon',
            "'": 'Quote',
            '`': 'Backquote',
        };
        const NAMES = Object.fromEntries(Object.entries(CODES).map(([name, code]) => [code, name]));
        const SYMBOLS = {
            backspace: '⌫',
            delete: '⌦',
            enter: '↩',
            escape: '⎋',
            tab: '⇥',
            left: '←',
            right: '→',
            up: '↑',
            down: '↓',
        };
        // Keys a focused text field owns whatever a plugin binds them to: caret moves and deletion with any
        // modifier (⌘← is the start of the line), and the ⌘ edit commands.
        const EDITING = new Set([
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Home',
            'End',
            'PageUp',
            'PageDown',
            'Backspace',
            'Delete',
        ]);
        const EDIT_COMMANDS = new Set(['KeyA', 'KeyC', 'KeyX', 'KeyV', 'KeyZ']);
        const MAC =
            typeof process !== 'undefined' && process.platform
                ? process.platform === 'darwin'
                : /Mac/i.test((typeof navigator !== 'undefined' && navigator.platform) || '');

        // MARK: - Initializer
        // MARK: - Public
        // A spec ("mod+shift+g") as the keys it holds. A chord is matched on the physical key, since a modifier
        // can change the character typed. A second key or an unknown word refuses the whole spec, so a typo is not
        // bound as another chord.
        function parse(spec) {
            const chord = { code: null, meta: false, ctrl: false, shift: false, alt: false };
            for (const written of String(spec || '')
                .toLowerCase()
                .split('+')) {
                const word = written.trim();
                if (!word) continue;
                if (word === 'mod') {
                    if (MAC) chord.meta = true;
                    else chord.ctrl = true;
                } else if (word === 'cmd' || word === 'meta') chord.meta = true;
                else if (word === 'ctrl' || word === 'control') chord.ctrl = true;
                else if (word === 'shift') chord.shift = true;
                else if (word === 'alt' || word === 'opt' || word === 'option') chord.alt = true;
                else if (chord.code) return null;
                else if (!(chord.code = codeOf(word))) return null;
            }
            return chord.code ? chord : null;
        }

        // One spelling per chord, so two specs compare as strings: "ctrl+alt+shift+cmd+t".
        function normalize(spec) {
            const chord = parse(spec);
            if (!chord) return null;
            return [
                chord.ctrl && 'ctrl',
                chord.alt && 'alt',
                chord.shift && 'shift',
                chord.meta && 'cmd',
                nameOf(chord.code),
            ]
                .filter(Boolean)
                .join('+');
        }

        // As the platform writes it: ⌃⌥⇧⌘ in that order on a Mac.
        function label(spec) {
            const chord = parse(spec);
            if (!chord) return '';
            const key = nameOf(chord.code);
            const name =
                MAC && SYMBOLS[key]
                    ? SYMBOLS[key]
                    : key.length === 1
                      ? key.toUpperCase()
                      : key.replace(/^./, (first) => first.toUpperCase());
            if (MAC)
                return (
                    (chord.ctrl ? '⌃' : '') +
                    (chord.alt ? '⌥' : '') +
                    (chord.shift ? '⇧' : '') +
                    (chord.meta ? '⌘' : '') +
                    name
                );
            return (
                (chord.ctrl ? 'Ctrl+' : '') +
                (chord.alt ? 'Alt+' : '') +
                (chord.shift ? 'Shift+' : '') +
                (chord.meta ? 'Win+' : '') +
                name
            );
        }

        // `input` has Electron's before-input-event shape: { code, meta, control, shift, alt }.
        function matches(chord, input) {
            return (
                !!chord &&
                chord.code === input.code &&
                chord.meta === !!input.meta &&
                chord.ctrl === !!input.control &&
                chord.shift === !!input.shift &&
                chord.alt === !!input.alt
            );
        }

        function fromEvent(event) {
            return {
                code: event.code,
                meta: event.metaKey,
                control: event.ctrlKey,
                shift: event.shiftKey,
                alt: event.altKey,
            };
        }

        function editsText(input) {
            return (
                EDITING.has(input.code) ||
                (!!input.meta && !input.control && !input.alt && EDIT_COMMANDS.has(input.code))
            );
        }

        // A key typed to be bound. A bare key is refused: bound, it would take that letter from every field on the
        // screen. Function keys are allowed, since nothing types them.
        function record(input) {
            if (/^(Meta|Control|Shift|Alt)(Left|Right)?$/.test(input.code)) return { pending: true };
            const key = nameOf(input.code);
            if (!key) return { error: 'That key cannot be bound' };
            if (!input.meta && !input.control && !input.alt && !/^f\d+$/.test(key))
                return { error: MAC ? 'Add ⌘, ⌃ or ⌥' : 'Add Ctrl or Alt' };
            return {
                spec: normalize(
                    [input.control && 'ctrl', input.alt && 'alt', input.shift && 'shift', input.meta && 'cmd', key]
                        .filter(Boolean)
                        .join('+')
                ),
            };
        }

        // Main and a page both ask these, so a recording ends on the same key in both.
        function cancels(input) {
            return bare(input) && input.code === 'Escape';
        }

        function clears(input) {
            return bare(input) && (input.code === 'Backspace' || input.code === 'Delete');
        }

        function endsRecording(input) {
            return cancels(input) || clears(input) || !!record(input).spec;
        }

        // MARK: - Private
        function codeOf(name) {
            if (/^[a-z]$/.test(name)) return 'Key' + name.toUpperCase();
            if (/^[0-9]$/.test(name)) return 'Digit' + name;
            if (/^f([1-9]|1[0-9])$/.test(name)) return name.toUpperCase();
            return CODES[name] || null;
        }

        function nameOf(code) {
            if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
            if (/^Digit[0-9]$/.test(code)) return code.slice(5);
            if (/^F([1-9]|1[0-9])$/.test(code)) return code.toLowerCase();
            return NAMES[code] || null;
        }

        function bare(input) {
            return !input.meta && !input.control && !input.alt && !input.shift;
        }

        return { parse, normalize, label, matches, fromEvent, editsText, record, cancels, clears, endsRecording };
    }
);
