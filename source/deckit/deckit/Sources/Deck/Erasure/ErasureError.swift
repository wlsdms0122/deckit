//
//  ErasureError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

public enum ErasureError: Refusal, Equatable {
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
