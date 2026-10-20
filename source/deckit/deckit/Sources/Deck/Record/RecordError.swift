//
//  RecordError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

enum RecordError: DeckError, Equatable {
    case notAKey(String)
    case notAMod(String)

    // MARK: - Property
    var kind: String {
        switch self {
        case .notAKey:
            "KEY"

        case .notAMod:
            "MOD"
        }
    }

    var message: String {
        switch self {
        case let .notAKey(key):
            "not a record key: \(key)"

        case let .notAMod(mod):
            "not a mod id: \(mod)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
