//
//  Dependency+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension Dependency: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case want
        case name
        case ok
        case optional
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(want, forKey: .want)
        try container.encode(name, forKey: .name)
        try container.encode(ok, forKey: .ok)
        try container.encode(optional, forKey: .optional)
    }

    // MARK: - Private
}
