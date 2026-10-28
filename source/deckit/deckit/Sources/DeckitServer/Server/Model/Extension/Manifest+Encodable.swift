//
//  Manifest+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

// The fields deckit adds beside deck's own.
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
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: Key.self)
        try container.encode(id, forKey: Key("id"))
        try container.encode(name, forKey: Key("name"))
        try container.encode(version, forKey: Key("version"))
        try container.encode(api, forKey: Key("api"))
        try container.encode(main, forKey: Key("main"))
        try container.encode(dependencies, forKey: Key("dependencies"))
        try container.encode(permissions, forKey: Key("permissions"))
        try container.encode(value(of: URLsField()), forKey: Key("urls"))
    }

    // MARK: - Private
}
