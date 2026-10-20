//
//  ErasureError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

public enum ErasureError: Refusal, Equatable {
    case notAMod(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notAMod(mod):
            "not a mod id: \(mod)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
