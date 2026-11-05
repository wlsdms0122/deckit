//
//  LoadOrderError.swift
//  Deck
//
//  Created by JSilver on 10/22/26.
//

import Foundation

// Why the mods are not put in an order.
public enum LoadOrderError: Refusal, Equatable {
    // A mod placed before one it requires.
    case requiredLater(mod: String, requirement: String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .requiredLater(mod, requirement):
            "\(mod) requires \(requirement), which would load after it"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
