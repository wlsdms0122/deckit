//
//  SettingValue+CustomStringConvertible.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// As a person reads it: a whole number with no fraction.
extension SettingValue: CustomStringConvertible {
    // MARK: - Property
    public var description: String {
        switch self {
        case let .bool(value):
            String(value)

        // Below 2^53 a double holds a whole number exactly, and Int64 takes it.
        case let .number(value):
            value == value.rounded() && abs(value) < 1e15 ? String(Int64(value)) : String(value)

        case let .string(value):
            value
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
