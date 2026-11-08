//
//  Declaration+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck
import Deckit

// `{ mod: { id, name }, credential: { mod, permissions }, entry }`: `mod` as a connection names the mod on its other
// end, and `credential` as a connection's is written.
extension Declaration: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
        case credential
        case entry
    }

    private enum ModKeys: String, CodingKey {
        case id
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
        try mod.encode(self.mod, forKey: .id)
        try mod.encode(name, forKey: .name)
        var credential = container.nestedContainer(keyedBy: CredentialKeys.self, forKey: .credential)
        try credential.encode(self.mod, forKey: .mod)
        try credential.encode(permissions, forKey: .permissions)
        try container.encode(entry, forKey: .entry)
    }

    // MARK: - Private
}
