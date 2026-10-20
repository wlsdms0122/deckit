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
        static let extensionPoints = Key(stringValue: "extensionPoints")
        static let extensions = Key(stringValue: "extensions")
        static let deck: Set<String> = [exports.stringValue, extensionPoints.stringValue, extensions.stringValue]

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
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Key.self)
        exports = try container.decode(Snapshot.self, forKey: .exports)
        extensionPoints = try container.decode([String].self, forKey: .extensionPoints)
        extensions = try container.decode([String: Snapshot].self, forKey: .extensions)
        var layers: [String: JSONValue] = [:]
        for key in container.allKeys where !Key.deck.contains(key.stringValue) {
            layers[key.stringValue] = try container.decode(JSONValue.self, forKey: key)
        }
        self.layers = layers
    }

    // MARK: - Public
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: Key.self)
        for (key, value) in layers {
            try container.encode(value, forKey: Key(stringValue: key))
        }
        try container.encode(exports, forKey: .exports)
        try container.encode(extensionPoints, forKey: .extensionPoints)
        try container.encode(extensions, forKey: .extensions)
    }

    // MARK: - Private
}
