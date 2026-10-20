//
//  URLRoute+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

extension URLRoute: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case url
        case handlers
        case system
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(url, forKey: .url)
        try container.encode(handlers, forKey: .handlers)
        try container.encodeIfPresent(system, forKey: .system)
    }

    // MARK: - Private
}
