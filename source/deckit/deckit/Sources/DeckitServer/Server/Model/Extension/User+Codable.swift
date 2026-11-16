//
//  User+Codable.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deckit

// `{ id, name }`.
extension User: Codable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case name
    }

    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try container.decode(String.self, forKey: .id),
            name: try container.decode(String.self, forKey: .name)
        )
    }

    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
    }

    // MARK: - Private
}
