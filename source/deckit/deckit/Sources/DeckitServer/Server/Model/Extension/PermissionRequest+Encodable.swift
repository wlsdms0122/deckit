//
//  PermissionRequest+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

// The id, what a layer defines it as, its reason and whether it is usable here, side by side.
extension PermissionRequest: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case privileged
        case reason
        case usable
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(permission?.name, forKey: .name)
        try container.encodeIfPresent(permission?.description, forKey: .description)
        try container.encodeIfPresent(permission?.privileged, forKey: .privileged)
        try container.encode(reason, forKey: .reason)
        try container.encode(usable, forKey: .usable)
    }

    // MARK: - Private
}
