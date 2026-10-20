//
//  RecordedKey.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a keystroke typed to be bound comes to: a modifier alone waits for the key, Escape cancels, Backspace or Delete
// clears, a key that may not be bound says why, and any other is the chord typed. A bare key is refused: bound, it
// would take that letter from every field on the screen. Function keys are allowed, since nothing types them.
enum RecordedKey: Equatable, Sendable {
    case pending
    case refused(String)
    case spec(String)
    case cancel
    case clear

    // MARK: - Property
    // MARK: - Initializer
    init(_ keystroke: Keystroke) {
        let bare = !keystroke.meta && !keystroke.control && !keystroke.alt
        if bare && !keystroke.shift && keystroke.code == "Escape" {
            self = .cancel
        } else if bare && !keystroke.shift && ["Backspace", "Delete"].contains(keystroke.code) {
            self = .clear
        } else if keystroke.code.wholeMatch(of: #/(Meta|Control|Shift|Alt)(Left|Right)?/#) != nil {
            self = .pending
        } else if let name = keystroke.name, let spec = keystroke.spec {
            if bare && name.wholeMatch(of: #/f\d+/#) == nil {
                self = .refused(Keystroke.isMac ? "Add ⌘, ⌃ or ⌥" : "Add Ctrl or Alt")
            } else {
                self = .spec(spec)
            }
        } else {
            self = .refused("That key cannot be bound")
        }
    }

    // MARK: - Public
    // MARK: - Private
}
