//
//  OrderError.swift
//  Deckit
//
//  Created by JSilver on 10/22/26.
//

import Foundation
import Deck

// Why the mods are not put in an order.
public enum OrderError: Refusal, Equatable {
    // A mod placed before one it requires.
    case requiredLater(mod: String, requirement: String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .requiredLater(mod, requirement):
            "\(mod) requires \(requirement), which is placed after it"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
