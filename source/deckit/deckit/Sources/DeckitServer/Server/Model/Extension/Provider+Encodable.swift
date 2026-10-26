//
//  Provider+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/25/26.
//

import Foundation
import Deckit

// `{ id, name, host }`: `host` for a host, which is no mod.
extension Provider: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case host
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(isHost, forKey: .host)
    }

    // MARK: - Private
}
