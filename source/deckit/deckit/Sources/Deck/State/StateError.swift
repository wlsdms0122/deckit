//
//  StateError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

enum StateError: DeckError, Equatable {
    case notAKey(String)
    case notAFolder(String)

    // MARK: - Property
    var kind: String {
        switch self {
        case .notAKey:
            "KEY"

        case .notAFolder:
            "FOLDER"
        }
    }

    var message: String {
        switch self {
        case let .notAKey(key):
            "not a state key: \(key)"

        case let .notAFolder(folder):
            "not a state folder: \(folder)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
