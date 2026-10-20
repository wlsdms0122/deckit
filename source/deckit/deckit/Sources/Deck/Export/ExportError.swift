//
//  ExportError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

enum ExportError: CallError, Equatable {
    case notADependency(mod: String, of: String)
    case notRunning(String)
    case ended(String, problem: String)
    case otherVersion(mod: String, version: String, dependent: String, wanted: String)
    case noSuchFunction(mod: String, path: [String])
    case needs(String, problem: String)

    // MARK: - Property
    var kind: String {
        switch self {
        case .notADependency:
            "DEPENDENCY"

        case .notRunning, .ended:
            "NOT_RUNNING"

        case .otherVersion:
            "VERSION"

        case .noSuchFunction:
            "FUNCTION"

        case .needs:
            "NEEDS"
        }
    }

    var message: String {
        switch self {
        case let .notADependency(mod, dependent):
            "\(mod) is in neither [requires] nor [optional] of \(dependent)"

        case let .notRunning(mod):
            "\(mod) is not running"

        case let .ended(mod, problem):
            "\(mod) is not running: \(problem)"

        case let .otherVersion(mod, version, dependent, wanted):
            "\(mod) is \(version), and the [optional] of \(dependent) names \(wanted)"

        case let .noSuchFunction(mod, path):
            "\(mod) exports no function \(path.joined(separator: "."))"

        case let .needs(mod, problem):
            "needs \(mod), which is not running: \(problem)"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
