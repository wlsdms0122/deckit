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
    case cannotWork(label: String, scope: KeyScope)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .noSuchBinding(id):
            "no such shortcut: \(id)"

        case let .notAChord(spec):
            "not a chord: \(spec)"

        case let .cannotWork(label, scope):
            "\(label) cannot work \(scope.phrase): \(Keystroke.wideRule)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
