//
//  JSONValue.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

public enum JSONValue: Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    public func decode<Value: Decodable>(as type: Value.Type) throws -> Value {
        let data = try JSONEncoder().encode(self)
        return try JSONDecoder().decode(type, from: data)
    }

    // MARK: - Private
}
