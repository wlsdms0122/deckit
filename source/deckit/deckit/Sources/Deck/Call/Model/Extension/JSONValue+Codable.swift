//
//  JSONValue+Codable.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

extension JSONValue: Codable {
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
            self = .object(try container.decode([String: JSONValue].self))
        }
    }

    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null:
            try container.encodeNil()

        case let .bool(value):
            try container.encode(value)

        case let .number(value):
            try container.encode(value)

        case let .string(value):
            try container.encode(value)

        case let .array(value):
            try container.encode(value)

        case let .object(value):
            try container.encode(value)
        }
    }
}
