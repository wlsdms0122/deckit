//
//  SettingError.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Why a setting was not set.
public enum SettingError: Refusal, Equatable {
    case undeclared(mod: String, key: String)
    case notOfType(key: String, type: SettingType)
    case notAnOption(key: String, value: SettingValue?)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .undeclared(mod, key):
            "\(mod) has no setting \"\(key)\""

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
