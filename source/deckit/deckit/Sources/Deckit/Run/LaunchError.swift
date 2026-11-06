//
//  LaunchError.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// Why a mod's ask that another launch is refused.
public enum LaunchError: Refusal, Equatable {
    // The mod asking is not granted the permission that lets it ask.
    case notPermitted(mod: String, permission: String)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .notPermitted(mod, permission):
            "\(mod) does not have the \(permission) permission"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
