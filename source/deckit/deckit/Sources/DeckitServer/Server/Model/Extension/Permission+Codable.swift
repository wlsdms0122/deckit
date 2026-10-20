//
//  Permission+Codable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension Permission: Codable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case means
        case reach
    }

    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try container.decode(String.self, forKey: .id),
            name: try container.decode(String.self, forKey: .name),
            means: try container.decode(String.self, forKey: .means),
            reach: try container.decode(PermissionReach.self, forKey: .reach)
        )
    }

    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(means, forKey: .means)
        try container.encode(reach, forKey: .reach)
    }

    // MARK: - Private
}
