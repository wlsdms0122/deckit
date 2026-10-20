//
//  SettingError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Why a setting was not set, or an action not run.
enum SettingError: DeckError, Equatable {
    case undeclared(mod: String, key: String)
    case notAnAction(mod: String, key: String)
    case isAnAction(String)
    case notOfType(key: String, type: SettingType)
    case notAnOption(key: String, value: SettingValue?)

    // MARK: - Property
    var kind: String {
        switch self {
        case .undeclared:
            "UNDECLARED"

        case .notAnAction:
            "NOT_AN_ACTION"

        case .isAnAction:
            "ACTION"

        case .notOfType:
            "TYPE"

        case .notAnOption:
            "OPTION"
        }
    }

    var message: String {
        switch self {
        case let .undeclared(mod, key):
            "\(mod) has no setting \"\(key)\""

        case let .notAnAction(mod, key):
            "\(mod) has no action \"\(key)\""

        case let .isAnAction(key):
            "\(key) is an action, not a value"

        case let .notOfType(key, .toggle):
            "\(key) is on or off"

        case let .notOfType(key, .number):
            "\(key) is a number"

        case let .notOfType(key, type):
            "\(key) is \(type.rawValue)"

        case let .notAnOption(key, value):
            "not an option of \(key): \(value.map(String.init(describing:)) ?? "none")"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
