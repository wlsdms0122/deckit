//
//  Put.swift
//  DeckitWeb
//
//  Created by JSilver on 11/15/26.
//

import AppKit

// An event put into a page for a seat that is not the machine's hardware (WebPage+Input), as UI Events names its
// parts: a button 0 (main), 1 (middle) or 2 (secondary), a key by its code.
enum Put {
    case pointer(Pointer)
    case key(Key)
    case text(Text)

    // The pointer moved to, pressed, let go or scrolled at `point`, from the page's top left: `button` the one
    // pressed or let go, `buttons` those held once it is, the seat's own as the page was put them where none is given,
    // `count` the click count of a press, `delta` how far a scroll goes, down and to the right.
    struct Pointer {
        enum Kind: String {
            case move
            case down
            case up
            case scroll
        }

        let kind: Kind
        let point: CGPoint
        let button: Int
        let buttons: [Int]?
        let modifiers: NSEvent.ModifierFlags
        let count: Int
        let delta: CGVector
    }

    // A key pressed or let go, typing `key`, with `modifiers` held.
    struct Key {
        let isDown: Bool
        let code: KeyCode
        let key: String
        let modifiers: NSEvent.ModifierFlags
        let isRepeat: Bool
    }

    // Text committed, the composition as it is now, and the composition committed as it is or given up.
    enum Text {
        case insert(String)
        case compose(String)
        case commit
        case cancel
    }

    // MARK: - Property
    static let modifiers: [(name: String, flag: NSEvent.ModifierFlags)] = [
        ("alt", .option), ("control", .control), ("meta", .command), ("shift", .shift)
    ]
    // The modifier each key that is one holds.
    static let modifierKeys: [String: NSEvent.ModifierFlags] = [
        "AltLeft": .option, "AltRight": .option, "ControlLeft": .control, "ControlRight": .control,
        "MetaLeft": .command, "MetaRight": .command, "ShiftLeft": .shift, "ShiftRight": .shift,
        "CapsLock": .capsLock, "Fn": .function
    ]

    // MARK: - Public
    // The bit of a button in the buttons the system says are pressed.
    static func bit(of button: Int) -> Int {
        switch button {
        case 1: 4
        case 2: 2
        default: 1
        }
    }

    static func names(of flags: NSEvent.ModifierFlags) -> [Any?] {
        modifiers.filter { flags.contains($0.flag) }.map(\.name)
    }

    static func buttons(of pressed: Int) -> [Any?] {
        [0, 1, 2].filter { pressed & bit(of: $0) != 0 }
    }
}
