//
//  Dependency+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/28/26.
//

import Foundation
import Deck

extension Dependency: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case version
        case optional
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(version, forKey: .version)
        try container.encode(optional, forKey: .optional)
    }

    // MARK: - Private
}
