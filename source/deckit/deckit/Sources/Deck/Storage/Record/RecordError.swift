//
//  RecordError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

public enum RecordError: Refusal, Equatable {
    case notAKey(String)
    // The disk has no room for the record.
    case outOfSpace(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notAKey(key):
            "not a record key: \(key)"

        case let .outOfSpace(key):
            "no room on the disk for the record \(key)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
