//
//  Pending+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension Pending: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
        case run
        case state
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(mod, forKey: .mod)
        try container.encode(run, forKey: .run)
        try container.encode(state, forKey: .state)
    }

    // MARK: - Private
}
