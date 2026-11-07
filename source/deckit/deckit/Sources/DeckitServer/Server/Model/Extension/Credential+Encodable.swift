//
//  Credential+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Deck
import Deckit

// The mod's id as `mod`, as main names it in what it asks.
extension Credential: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
        case permissions
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(modId, forKey: .mod)
        try container.encode(permissions, forKey: .permissions)
    }

    // MARK: - Private
}
