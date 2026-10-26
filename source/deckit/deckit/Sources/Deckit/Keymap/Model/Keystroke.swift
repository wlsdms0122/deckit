//
//  Keystroke.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A key as it is pressed: the physical key, by its code, and the modifiers held with it. A chord is matched on the
// physical key, since a modifier can change the character typed.
public struct Keystroke: Equatable, Sendable {
    // MARK: - Property
    // What a key that works past its page, taken from every page, text fields included, needs of its chord.
    static let wideRule = "a key that works past its page needs ⌘, ⌃ or ⌥, and none a field with focus takes"
    // `mod` is ⌘ on a Mac, and Ctrl elsewhere.
    static let isMac: Bool = {
        #if os(macOS)
        true
        #else
        false
        #endif
    }()

    // A key's name in a spec, by its physical code.
    private static let codes: [String: String] = [
        "left": "ArrowLeft",
        "right": "ArrowRight",
        "up": "ArrowUp",
        "down": "ArrowDown",
        "enter": "Enter",
        "escape": "Escape",
        "space": "Space",
        "tab": "Tab",
        "backspace": "Backspace",
        "delete": "Delete",
        "[": "BracketLeft",
        "]": "BracketRight",
        ",": "Comma",
        ".": "Period",
        "/": "Slash",
        "\\": "Backslash",
        "-": "Minus",
        "=": "Equal",
        ";": "Semicolon",
        "'": "Quote",
        "`": "Backquote"
    ]
    private static let names = Dictionary(uniqueKeysWithValues: codes.map { name, code in (code, name) })
    private static let symbols: [String: String] = [
        "backspace": "⌫",
        "delete": "⌦",
        "enter": "↩",
        "escape": "⎋",
        "tab": "⇥",
        "left": "←",
        "right": "→",
        "up": "↑",
        "down": "↓"
    ]
    // Keys a focused text field owns whatever a mod binds them to: caret moves and deletion with any modifier (⌘← is
    // the start of the line), and the ⌘ edit commands.
    private static let editing: Set<String> = [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "PageUp",
        "PageDown",
        "Backspace",
        "Delete"
    ]
    private static let editCommands: Set<String> = ["KeyA", "KeyC", "KeyX", "KeyV", "KeyZ"]

    public let code: String
    public let meta: Bool
    public let control: Bool
    public let shift: Bool
    public let alt: Bool

    // The key's name in a spec, or nil for a key a spec cannot name.
    public var name: String? {
        if code.wholeMatch(of: #/Key[A-Z]/#) != nil { return code.dropFirst(3).lowercased() }
        if code.wholeMatch(of: #/Digit[0-9]/#) != nil { return String(code.dropFirst(5)) }
        if code.wholeMatch(of: #/F([1-9]|1[0-9])/#) != nil { return code.lowercased() }
        return Self.names[code]
    }

    // One spelling per chord, so two specs compare as strings: "ctrl+alt+shift+cmd+t".
    public var spec: String? {
        guard let name else { return nil }
        let modifiers = [(control, "ctrl"), (alt, "alt"), (shift, "shift"), (meta, "cmd")]
            .filter { held, _ in held }
            .map { _, word in word }

        return (modifiers + [name]).joined(separator: "+")
    }

    // As the platform writes it: ⌃⌥⇧⌘ in that order on a Mac.
    public var label: String {
        guard let name else { return "" }
        let key = if Self.isMac, let symbol = Self.symbols[name] {
            symbol
        } else {
            name.count == 1 ? name.uppercased() : name.prefix(1).uppercased() + name.dropFirst()
        }
        guard Self.isMac else {
            let modifiers = [(control, "Ctrl+"), (alt, "Alt+"), (shift, "Shift+"), (meta, "Win+")]
            return modifiers.filter { held, _ in held }.map { _, word in word }.joined() + key
        }

        return (control ? "⌃" : "") + (alt ? "⌥" : "") + (shift ? "⇧" : "") + (meta ? "⌘" : "") + key
    }

    // Whether a field with focus may take it: one that edits text, and Return with ⌘, ⌃ or ⌥, which a code editor
    // or a text area acts on.
    public var takenByFields: Bool {
        Self.editing.contains(code) || (meta && !control && !alt && Self.editCommands.contains(code))
            || (code == "Enter" && (meta || control || alt))
    }

    // Whether it may work in `scope`: past its page only by `wideRule`.
    func fits(_ scope: KeyScope) -> Bool {
        !scope.isWide || ((meta || control || alt) && !takenByFields)
    }

    // MARK: - Initializer
    public init(code: String, meta: Bool, control: Bool, shift: Bool, alt: Bool) {
        self.code = code
        self.meta = meta
        self.control = control
        self.shift = shift
        self.alt = alt
    }

    // A spec ("mod+shift+g") as the keystroke it names. A second key or an unknown word refuses the whole spec, so a
    // typo is not bound as another chord.
    public init?(spec: String) {
        var code: String?
        var meta = false
        var control = false
        var shift = false
        var alt = false
        for written in spec.lowercased().split(separator: "+", omittingEmptySubsequences: false) {
            let word = written.trimmingCharacters(in: .whitespaces)
            switch word {
            case "":
                continue

            case "mod":
                if Self.isMac { meta = true } else { control = true }

            case "cmd", "meta":
                meta = true

            case "ctrl", "control":
                control = true

            case "shift":
                shift = true

            case "alt", "opt", "option":
                alt = true

            default:
                guard code == nil, let named = Self.code(of: word) else { return nil }
                code = named
            }
        }
        guard let code else { return nil }

        self.init(code: code, meta: meta, control: control, shift: shift, alt: alt)
    }

    // MARK: - Public
    // MARK: - Private
    private static func code(of name: String) -> String? {
        if name.wholeMatch(of: #/[a-z]/#) != nil { return "Key" + name.uppercased() }
        if name.wholeMatch(of: #/[0-9]/#) != nil { return "Digit" + name }
        if name.wholeMatch(of: #/f([1-9]|1[0-9])/#) != nil { return name.uppercased() }
        return codes[name]
    }
}
