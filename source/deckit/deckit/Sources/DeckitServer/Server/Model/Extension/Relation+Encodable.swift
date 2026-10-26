//
//  Relation+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension Relation: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case kind
        case want
        case name
        case ok
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(kind.rawValue, forKey: .kind)
        try container.encode(want, forKey: .want)
        try container.encode(name, forKey: .name)
        try container.encode(ok, forKey: .ok)
    }

    // MARK: - Private
}
