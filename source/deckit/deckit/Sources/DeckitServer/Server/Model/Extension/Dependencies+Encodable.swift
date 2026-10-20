//
//  Dependencies+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension Dependencies: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case requires
        case optional
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(requires, forKey: .requires)
        try container.encode(optional, forKey: .optional)
    }

    // MARK: - Private
}
