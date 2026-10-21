//
//  ModStorageError.swift
//  Deck
//
//  Created by JSilver on 10/21/26.
//

import Foundation

public enum ModStorageError: Refusal, Equatable {
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
