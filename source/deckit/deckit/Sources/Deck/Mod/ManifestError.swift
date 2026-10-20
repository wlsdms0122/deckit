//
//  ManifestError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What the layers on deck are refused with as they add to the manifest.
enum ManifestError: DeckError, Equatable {
    case permissionDefined(String)
    case fieldDefined(String)

    // MARK: - Property
    var kind: String {
        switch self {
        case .permissionDefined:
            "PERMISSION"

        case .fieldDefined:
            "FIELD"
        }
    }

    var message: String {
        switch self {
        case let .permissionDefined(id):
            "the permission \(id) is defined twice"

        case let .fieldDefined(name):
            "the manifest field \(name) is defined twice"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
