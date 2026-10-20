//
//  KeymapError.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

enum KeymapError: CallError, Equatable {
    case noSuchBinding(String)
    case notAChord(String)
    case cannotBeGlobal(label: String)

    // MARK: - Property
    var kind: String {
        switch self {
        case .noSuchBinding:
            "SHORTCUT"

        case .notAChord:
            "CHORD"

        case .cannotBeGlobal:
            "REFUSED"
        }
    }

    var message: String {
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
