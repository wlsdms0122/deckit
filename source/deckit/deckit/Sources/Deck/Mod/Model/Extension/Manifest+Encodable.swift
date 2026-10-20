//
//  Manifest+Encodable.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The layers' fields beside deck's own.
extension Manifest: Encodable {
    // MARK: - Property
    private struct Key: CodingKey {
        let stringValue: String
        let intValue: Int? = nil

        init(_ stringValue: String) {
            self.stringValue = stringValue
        }

        init(stringValue: String) {
            self.stringValue = stringValue
        }

        init?(intValue: Int) {
            nil
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: Key.self)
        try container.encode(id, forKey: Key("id"))
        try container.encode(name, forKey: Key("name"))
        try container.encode(version, forKey: Key("version"))
        try container.encode(api, forKey: Key("api"))
        try container.encode(main, forKey: Key("main"))
        try container.encode(requires, forKey: Key("requires"))
        try container.encode(optional, forKey: Key("optional"))
        try container.encode(permissions, forKey: Key("permissions"))
        for (key, value) in fields {
            try container.encode(value, forKey: Key(key))
        }
    }

    // MARK: - Private
}
