//
//  Contribution+Codable.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// One object: deck's keys beside the layers', which never take one of deck's.
extension Contribution: Codable {
    // MARK: - Property
    private struct Key: CodingKey {
        static let exports = Key(stringValue: "exports")
        static let awaits = Key(stringValue: "awaits")
        static let deck: Set<String> = [exports.stringValue, awaits.stringValue]

        let stringValue: String
        var intValue: Int? { nil }

        init(stringValue: String) {
            self.stringValue = stringValue
        }

        init?(intValue: Int) {
            nil
        }
    }

    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Key.self)
        exports = try container.decodeIfPresent(Int.self, forKey: .exports)
        awaits = try container.decode([String: Int].self, forKey: .awaits)
        var layers: [String: JSONValue] = [:]
        for key in container.allKeys where !Key.deck.contains(key.stringValue) {
            layers[key.stringValue] = try container.decode(JSONValue.self, forKey: key)
        }
        self.layers = layers
    }

    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: Key.self)
        for (key, value) in layers {
            try container.encode(value, forKey: Key(stringValue: key))
        }
        try container.encodeIfPresent(exports, forKey: .exports)
        try container.encode(awaits, forKey: .awaits)
    }

    // MARK: - Private
}
