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
    // An interface no mod implements or depends on, which has no list to order.
    case noInterface(String)
    // Mods that would require one another, as `<id> → … → <id>`.
    case cycle([String])

    // MARK: - Property
    public var message: String {
        switch self {
        case let .requiredLater(mod, requirement):
            "\(mod) requires \(requirement), which would load after it"

        case let .noInterface(interface):
            "no mod implements or depends on \(interface)"

        case let .cycle(loop):
            "the mods would require themselves: " + loop.joined(separator: " → ")
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
