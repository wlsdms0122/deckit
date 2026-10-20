//
//  HandlerList+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

extension HandlerList: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case scheme
        case system
        case handlers
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(scheme, forKey: .scheme)
        try container.encodeIfPresent(system, forKey: .system)
        try container.encode(handlers, forKey: .handlers)
    }

    // MARK: - Private
}
