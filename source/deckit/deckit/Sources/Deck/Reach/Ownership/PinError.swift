//
//  PinError.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// Why a mod is not pinned as an interface's owner.
public enum PinError: Refusal, Equatable {
    // A mod that does not provide the interface.
    case notProvider(interface: String, mod: String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notProvider(interface, mod):
            "\(mod) does not provide \(interface)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
