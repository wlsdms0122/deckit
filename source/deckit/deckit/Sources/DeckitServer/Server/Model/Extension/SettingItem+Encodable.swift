//
//  SettingItem+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The declaration's fields, `default` as declared, with the value and the options on offer.
extension SettingItem: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case key
        case type
        case label
        case defaultValue = "default"
        case hint
        case computed
        case min
        case max
        case step
        case unit
        case placeholder
        case value
        case options
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(declaration.key, forKey: .key)
        try container.encode(declaration.type, forKey: .type)
        try container.encodeIfPresent(declaration.label, forKey: .label)
        try container.encodeIfPresent(declaration.defaultValue, forKey: .defaultValue)
        try container.encodeIfPresent(declaration.hint, forKey: .hint)
        try container.encode(declaration.computed, forKey: .computed)
        try container.encodeIfPresent(declaration.min, forKey: .min)
        try container.encodeIfPresent(declaration.max, forKey: .max)
        try container.encodeIfPresent(declaration.step, forKey: .step)
        try container.encodeIfPresent(declaration.unit, forKey: .unit)
        try container.encodeIfPresent(declaration.placeholder, forKey: .placeholder)
        try container.encodeIfPresent(value, forKey: .value)
        try container.encode(options, forKey: .options)
    }

    // MARK: - Private
}
