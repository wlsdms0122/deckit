//
//  Seat+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deckit

// `{ id, user: { id, name }, local }`.
extension Seat: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case user
        case local
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(user, forKey: .user)
        try container.encode(local, forKey: .local)
    }

    // MARK: - Private
}
