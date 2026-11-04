//
//  Relation+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension Relation: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case interface
        case optional
        case version
        case id
        case name
        case problem
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(interface, forKey: .interface)
        try container.encode(optional, forKey: .optional)
        try container.encode(version, forKey: .version)
        try container.encodeIfPresent(id, forKey: .id)
        try container.encodeIfPresent(name, forKey: .name)
        try container.encodeIfPresent(problem, forKey: .problem)
    }

    // MARK: - Private
}
