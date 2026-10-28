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
        static let exportedIn = Key(stringValue: "exportedIn")
        static let awaits = Key(stringValue: "awaits")
        static let deck: Set<String> = [exportedIn.stringValue, awaits.stringValue]

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
        exportedIn = try container.decodeIfPresent(Int.self, forKey: .exportedIn)
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
        try container.encodeIfPresent(exportedIn, forKey: .exportedIn)
        try container.encode(awaits, forKey: .awaits)
    }

    // MARK: - Private
}
