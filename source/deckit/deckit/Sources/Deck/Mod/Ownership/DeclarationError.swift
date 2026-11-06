//
//  DeclarationError.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// Why what is declared to an interface is not handed over.
public enum DeclarationError: Refusal, Equatable {
    // A mod that does not own the interface now.
    case notOwner(interface: String, mod: String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notOwner(interface, mod):
            "\(mod) does not own \(interface)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
