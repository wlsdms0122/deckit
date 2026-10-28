//
//  Endpoint+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/28/26.
//

import Foundation
import Deck

// The mod's id as `mod`, as main names it in what it asks.
extension Endpoint: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
        case run
        case lifecycle
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(modId, forKey: .mod)
        try container.encode(run, forKey: .run)
        try container.encode(lifecycle, forKey: .lifecycle)
    }

    // MARK: - Private
}
