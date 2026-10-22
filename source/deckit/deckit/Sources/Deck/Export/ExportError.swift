//
//  ExportError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

public enum ExportError: Refusal, Equatable {
    case notADependency(mod: String, of: String)
    case notRunning(String)
    case otherVersion(mod: String, version: String, dependent: String, wanted: String)
    case noSuchFunction(mod: String, path: [String])

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notADependency(mod, dependent):
            "\(mod) is in neither [requires] nor [optional] of \(dependent)"

        case let .notRunning(mod):
            "\(mod) is not running"

        case let .otherVersion(mod, version, dependent, wanted):
            "\(mod) is \(version), and the [optional] of \(dependent) names \(wanted)"

        case let .noSuchFunction(mod, path):
            "\(mod) exports no function \(path.joined(separator: "."))"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
