//
//  Connection+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/28/26.
//

import Foundation
import Deck

extension Connection: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case dependent
        case dependency
        case required
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(dependent, forKey: .dependent)
        try container.encode(dependency, forKey: .dependency)
        try container.encode(required, forKey: .required)
    }

    // MARK: - Private
}
