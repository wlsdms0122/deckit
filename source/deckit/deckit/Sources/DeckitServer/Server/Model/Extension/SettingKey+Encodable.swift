//
//  SettingKey+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension SettingKey: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
        case key
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(mod, forKey: .mod)
        try container.encode(key, forKey: .key)
    }

    // MARK: - Private
}
