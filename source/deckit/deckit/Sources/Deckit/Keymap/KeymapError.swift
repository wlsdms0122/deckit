//
//  KeymapError.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

public enum KeymapError: Refusal, Equatable {
    case noSuchBinding(String)
    case notAChord(String)
    case cannotReach(label: String, reach: KeyReach)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .noSuchBinding(id):
            "no such shortcut: \(id)"

        case let .notAChord(spec):
            "not a chord: \(spec)"

        case let .cannotReach(label, reach):
            "\(label) cannot work \(reach.phrase): \(Keystroke.wideRule)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
