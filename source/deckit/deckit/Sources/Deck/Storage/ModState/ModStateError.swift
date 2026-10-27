//
//  ModStateError.swift
//  Deck
//
//  Created by JSilver on 10/27/26.
//

import Foundation

public enum ModStateError: Refusal, Equatable {
    case notAName(String)
    case reserved(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notAName(name):
            "not a name to keep a mod's state under: \(name)"

        case let .reserved(name):
            "a mod's state named \(name) is kept already"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
