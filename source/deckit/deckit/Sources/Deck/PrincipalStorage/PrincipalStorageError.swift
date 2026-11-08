//
//  PrincipalStorageError.swift
//  Deck
//
//  Created by JSilver on 10/21/26.
//

import Foundation

public enum PrincipalStorageError: Refusal, Equatable {
    case notAPrincipal(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notAPrincipal(principal):
            "not an id: \(principal)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
