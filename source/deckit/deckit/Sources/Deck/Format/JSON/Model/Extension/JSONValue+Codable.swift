//
//  JSONValue+Codable.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// An object through a container keyed by its names, so a coder that keeps each name it is given keeps two names of one
// canonical form as two. Foundation's JSONDecoder and JSONEncoder key an object by Strings and take them as one:
// JSONParser and JSONWriter keep them.
extension JSONValue: Codable {
    // MARK: - Property
    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            let object = try decoder.container(keyedBy: JSONName.self)
            let members = try object.allKeys.map { name in (name, try object.decode(JSONValue.self, forKey: name)) }
            self = .object(Dictionary(members) { first, _ in first })
        }
    }

    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        switch self {
        case .null:
            var container = encoder.singleValueContainer()
            try container.encodeNil()

        case let .bool(value):
            var container = encoder.singleValueContainer()
            try container.encode(value)

        case let .number(value):
            var container = encoder.singleValueContainer()
            try container.encode(value)

        case let .string(value):
            var container = encoder.singleValueContainer()
            try container.encode(value)

        case let .array(value):
            var container = encoder.singleValueContainer()
            try container.encode(value)

        case let .object(members):
            var container = encoder.container(keyedBy: JSONName.self)
            for (name, value) in members {
                try container.encode(value, forKey: name)
            }
        }
    }

    // MARK: - Private
}
