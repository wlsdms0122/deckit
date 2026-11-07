//
//  JSONValue+TOMLValue.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

extension JSONValue {
    // MARK: - Property
    // MARK: - Initializer
    // `value` as JSON writes it: a table as an object, an integer as a number. An object's keys are Strings, which
    // take two keys of one canonical form as one: of those, the key that comes first is kept.
    init(_ value: TOMLValue) {
        switch value {
        case let .string(text):
            self = .string(text)

        case let .integer(number):
            self = .number(Double(number))

        case let .boolean(flag):
            self = .bool(flag)

        case let .array(values):
            self = .array(values.map(JSONValue.init))

        case let .table(fields):
            let pairs = fields.sorted { one, other in one.key < other.key }.map { key, value in
                (key.text, JSONValue(value))
            }
            self = .object(Dictionary(pairs) { first, _ in first })
        }
    }

    // MARK: - Public
    // MARK: - Private
}
