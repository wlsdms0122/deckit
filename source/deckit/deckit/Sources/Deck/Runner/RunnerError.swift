//
//  RunnerError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Why a mod's page does not run, or the mod does not launch again.
enum RunnerError: CallError, Equatable {
    case noSandbox(String)
    case closing(String)
    case quitting(String)
    case needs(mod: String, requirement: String)

    // MARK: - Property
    var kind: String {
        switch self {
        case .noSandbox:
            "NO_SANDBOX"

        case .closing:
            "CLOSING"

        case .quitting:
            "QUITTING"

        case .needs:
            "NEEDS"
        }
    }

    var message: String {
        switch self {
        case let .noSandbox(mod):
            "\(mod) has no sandbox"

        case let .closing(mod):
            "\(mod) is going"

        case let .quitting(mod):
            "\(mod) does not launch while the app quits"

        case let .needs(mod, requirement):
            "\(mod) needs \(requirement), which is not running"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
