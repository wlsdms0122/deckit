//
//  Implementation+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/4/26.
//

import Foundation
import Deck

extension Implementation: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case version
        case on
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(version, forKey: .version)
        try container.encode(on, forKey: .on)
    }

    // MARK: - Private
}
