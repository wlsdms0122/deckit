//
//  ShippedMod+Decodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Deck
import Deckit

// Its folder as a path.
extension ShippedMod: Decodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case folder
        case system
    }

    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            folder: URL(filePath: try container.decode(String.self, forKey: .folder)),
            system: try container.decode(Bool.self, forKey: .system)
        )
    }

    // MARK: - Public
    // MARK: - Private
}
