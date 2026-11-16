//
//  LaunchError.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// Why a launch is refused: what asks it, or the run it came to.
public enum LaunchError: Refusal, Equatable {
    // The mod asking is not granted the permission that lets it ask.
    case notPermitted(mod: String, permission: String)
    // No mod is listed under the id.
    case notInstalled(String)
    // The mod is at the relaunch limit.
    case relaunchLimit(String)
    // Its run's code did not start in time, and why.
    case timedOut(mod: String, problem: String)
    // Its run did not launch, and why.
    case notLaunched(mod: String, problem: String)
    // The principal a transport connection is verified as runs already.
    case alreadyRunning(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notPermitted(mod, permission):
            "\(mod) does not have the \(permission) permission"

        case let .notInstalled(id):
            "no mod is listed under \(id)"

        case let .relaunchLimit(mod):
            "\(mod) is at the relaunch limit"

        case let .timedOut(mod, problem), let .notLaunched(mod, problem):
            "\(mod) did not launch: \(problem)"

        case let .alreadyRunning(principal):
            "\(principal) runs already"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
