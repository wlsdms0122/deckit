//
//  RecordError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

public enum RecordError: Refusal, Equatable {
    case notAKey(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notAKey(key):
            "not a record key: \(key)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
