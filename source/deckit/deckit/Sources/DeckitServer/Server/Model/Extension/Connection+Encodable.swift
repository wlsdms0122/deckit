//
//  Connection+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/28/26.
//

import Foundation
import Deck
import Deckit

extension Connection: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case dependent
        case dependency
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(dependent, forKey: .dependent)
        try container.encode(dependency, forKey: .dependency)
    }

    // MARK: - Private
}
