//
//  TOMLValue+CustomStringConvertible.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// As TOML writes it, for a message that quotes what a mod wrote.
extension TOMLValue: CustomStringConvertible {
    // MARK: - Property
    public var description: String {
        switch self {
        case let .string(value):
            "\"\(value.replacing("\\", with: "\\\\").replacing("\"", with: "\\\""))\""

        case let .integer(value):
            String(value)

        case let .boolean(value):
            String(value)

        case let .array(values):
            "[\(values.map(\.description).joined(separator: ", "))]"

        case let .table(values):
            "{ \(values.keys.sorted().map { key in "\(key.text) = \(values[key]!)" }.joined(separator: ", ")) }"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
