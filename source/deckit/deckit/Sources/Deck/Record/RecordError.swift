//
//  RecordError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

enum RecordError: CallError, Equatable {
    case notAKey(String)

    // MARK: - Property
    var kind: String {
        switch self {
        case .notAKey:
            "KEY"
        }
    }

    var message: String {
        switch self {
        case let .notAKey(key):
            "not a record key: \(key)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
