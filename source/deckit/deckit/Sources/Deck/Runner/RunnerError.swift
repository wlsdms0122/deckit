//
//  RunnerError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Why a mod's page does not run, or the mod does not launch again.
public enum RunnerError: Refusal, Equatable {
    case noSandbox(String)
    case closing(String)
    case quitting(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .noSandbox(mod):
            "\(mod) has no sandbox"

        case let .closing(mod):
            "\(mod) is going"

        case let .quitting(mod):
            "\(mod) does not launch while the app quits"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
