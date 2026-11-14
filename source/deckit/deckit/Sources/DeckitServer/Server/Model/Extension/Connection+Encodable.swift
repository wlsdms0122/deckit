//
//  Connection+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/28/26.
//

import Foundation
import Deck
import Deckit

// With the client's credential, which its service is told.
extension Connection: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case client
        case service
        case credential
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(client, forKey: .client)
        try container.encode(service, forKey: .service)
        try container.encode(credential, forKey: .credential)
    }

    // MARK: - Private
}
