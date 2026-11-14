//
//  Permission+Codable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

extension Permission: Codable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case privileged
    }

    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try container.decode(String.self, forKey: .id),
            name: try container.decode(String.self, forKey: .name),
            description: try container.decode(String.self, forKey: .description),
            privileged: try container.decode(Bool.self, forKey: .privileged)
        )
    }

    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(description, forKey: .description)
        try container.encode(privileged, forKey: .privileged)
    }

    // MARK: - Private
}
