//
//  LaunchRequest+Decodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// As `mod`, the id, and `origin`.
extension LaunchRequest: Decodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
        case origin
    }

    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            modId: try container.decode(String.self, forKey: .mod),
            origin: try container.decode(LaunchOrigin.self, forKey: .origin)
        )
    }

    // MARK: - Public
    // MARK: - Private
}
