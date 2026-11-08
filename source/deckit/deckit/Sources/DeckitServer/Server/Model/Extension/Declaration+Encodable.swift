//
//  Declaration+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck
import Deckit

// `{ mod: { name }, credential: { mod, permissions }, entry }`: `mod` and `credential` as a connection's are written,
// the declaring mod's id in `credential` alone.
extension Declaration: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
        case credential
        case entry
    }

    private enum ModKeys: String, CodingKey {
        case name
    }

    private enum CredentialKeys: String, CodingKey {
        case mod
        case permissions
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        var mod = container.nestedContainer(keyedBy: ModKeys.self, forKey: .mod)
        try mod.encode(name, forKey: .name)
        var credential = container.nestedContainer(keyedBy: CredentialKeys.self, forKey: .credential)
        try credential.encode(self.mod, forKey: .mod)
        try credential.encode(permissions, forKey: .permissions)
        try container.encode(entry, forKey: .entry)
    }

    // MARK: - Private
}
