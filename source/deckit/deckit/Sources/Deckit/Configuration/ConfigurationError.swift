//
//  ConfigurationError.swift
//  Deckit
//
//  Created by JSilver on 10/27/26.
//

import Foundation
import Deck

// Why a configuration was not set.
public enum ConfigurationError: Refusal, Equatable {
    case undeclared(mod: String, key: String)
    case notOfType(key: String, type: ConfigurationType)
    case notAChoice(key: String, value: ConfigurationValue?)

    // MARK: - Property
    public var message: String {
        switch self {
        case let .undeclared(mod, key):
            "\(mod) has no configuration \"\(key)\""

        case let .notOfType(key, .boolean):
            "\(key) is true or false"

        case let .notOfType(key, .number):
            "\(key) is a number"

        case let .notOfType(key, .string):
            "\(key) is text"

        case let .notAChoice(key, value):
            "not one of what \(key) takes: \(value.map(String.init(describing:)) ?? "none")"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
