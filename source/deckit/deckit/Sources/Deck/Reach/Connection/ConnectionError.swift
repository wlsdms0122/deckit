//
//  ConnectionError.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

public enum ConnectionError: Refusal, Equatable {
    case notRunning(String)
    case ended
    case notAnEnd(mod: String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notRunning(mod):
            "\(mod) is not running"

        case .ended:
            "the mod on the other end has ended"

        case let .notAnEnd(mod):
            "\(mod) is not an end of that connection"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
