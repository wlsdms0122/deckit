//
//  LaunchRequest+Decodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck
import Deckit

// As `mod`, the id. An `origin` sent beside it is not read.
extension LaunchRequest: Decodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
    }

    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(modId: try container.decode(String.self, forKey: .mod))
    }

    // MARK: - Public
    // MARK: - Private
}
