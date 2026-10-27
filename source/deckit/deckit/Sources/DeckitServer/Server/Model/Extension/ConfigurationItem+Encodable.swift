//
//  ConfigurationItem+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

// The declaration's fields, `default` as declared, with the value it reads as.
extension ConfigurationItem: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case key
        case type
        case title
        case description
        case defaultValue = "default"
        case oneOf
        case minimum
        case maximum
        case value
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(declaration.key, forKey: .key)
        try container.encode(declaration.type, forKey: .type)
        try container.encodeIfPresent(declaration.title, forKey: .title)
        try container.encodeIfPresent(declaration.description, forKey: .description)
        try container.encodeIfPresent(declaration.defaultValue, forKey: .defaultValue)
        try container.encode(declaration.oneOf, forKey: .oneOf)
        try container.encodeIfPresent(declaration.minimum, forKey: .minimum)
        try container.encodeIfPresent(declaration.maximum, forKey: .maximum)
        try container.encodeIfPresent(value, forKey: .value)
    }

    // MARK: - Private
}
