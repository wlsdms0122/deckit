//
//  Declaration+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck
import Deckit

// `{ mod: { id, name }, entry }`: `mod` as a connection names the mod on its other end.
extension Declaration: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
        case entry
    }

    private enum ModKeys: String, CodingKey {
        case id
        case name
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        var mod = container.nestedContainer(keyedBy: ModKeys.self, forKey: .mod)
        try mod.encode(self.mod, forKey: .id)
        try mod.encode(name, forKey: .name)
        try container.encode(entry, forKey: .entry)
    }

    // MARK: - Private
}
