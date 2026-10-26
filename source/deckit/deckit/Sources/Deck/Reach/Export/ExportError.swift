//
//  ExportError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

public enum ExportError: Refusal, Equatable {
    case notRequired(mod: String, of: String)
    case notRunning(String)
    case noSuchFunction(mod: String, path: [String])

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notRequired(mod, dependent):
            "\(mod) is not in [requires] of \(dependent)"

        case let .notRunning(mod):
            "\(mod) is not running"

        case let .noSuchFunction(mod, path):
            "\(mod) exports no function \(path.joined(separator: "."))"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
