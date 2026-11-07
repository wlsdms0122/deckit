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
    // `value` as JSON writes it: a table as an object of the keys it holds, each named by its key's text, and an
    // integer as a number.
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
            self = .object(Dictionary(uniqueKeysWithValues: fields.map { key, value in
                (JSONName(key.text), JSONValue(value))
            }))
        }
    }

    // MARK: - Public
    // MARK: - Private
}
