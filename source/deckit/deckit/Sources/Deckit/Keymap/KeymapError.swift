//
//  KeymapError.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

public enum KeymapError: DeckError, Equatable {
    case noSuchBinding(String)
    case notAChord(String)
    case cannotBeGlobal(label: String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .noSuchBinding(id):
            "no such shortcut: \(id)"

        case let .notAChord(spec):
            "not a chord: \(spec)"

        case let .cannotBeGlobal(label):
            "\(label) cannot work everywhere: \(Keystroke.globalRule)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
