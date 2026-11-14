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
    case object([JSONName: JSONValue])

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // The value as `type` decodes it from the JSON text it is written as.
    public func decode<Value: Decodable>(as type: Value.Type) throws -> Value {
        let data = try JSONWriter().write(self)
        return try JSONDecoder().decode(type, from: data)
    }

    // MARK: - Private
}
