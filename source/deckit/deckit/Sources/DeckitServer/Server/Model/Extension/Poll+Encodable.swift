//
//  Poll+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// `{ ready }` or `{ pending }`.
extension Poll: Encodable where Value: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case ready
        case pending
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .ready(value):
            try container.encode(value, forKey: .ready)

        case let .pending(pending):
            try container.encode(pending, forKey: .pending)
        }
    }

    // MARK: - Private
}
