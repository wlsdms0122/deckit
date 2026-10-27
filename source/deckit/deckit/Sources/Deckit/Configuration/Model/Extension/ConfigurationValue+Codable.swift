//
//  ConfigurationValue+Codable.swift
//  Deckit
//
//  Created by JSilver on 10/27/26.
//

import Foundation

extension ConfigurationValue: Codable {
    // MARK: - Property
    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else {
            self = .string(try container.decode(String.self))
        }
    }

    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case let .bool(value):
            try container.encode(value)

        case let .number(value):
            try container.encode(value)

        case let .string(value):
            try container.encode(value)
        }
    }

    // MARK: - Private
}
