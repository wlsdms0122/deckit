//
//  EventDelivery+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension EventDelivery: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case name
        case listeners
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(name, forKey: .name)
        try container.encode(listeners, forKey: .listeners)
    }

    // MARK: - Private
}
