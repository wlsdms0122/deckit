//
//  LoadOrderError.swift
//  Deck
//
//  Created by JSilver on 10/22/26.
//

import Foundation

// Why the mods are not put in an order.
public enum LoadOrderError: Refusal, Equatable {
    // The settings file the order is kept in, which does not read as a JSON object.
    case unreadable(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .unreadable(file):
            "\(file) does not read as a JSON object, so the order is not kept in it"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
