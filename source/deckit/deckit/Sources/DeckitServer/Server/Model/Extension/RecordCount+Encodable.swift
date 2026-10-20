//
//  RecordCount+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension RecordCount: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case count
        case hidden
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(count, forKey: .count)
        try container.encode(hidden, forKey: .hidden)
    }

    // MARK: - Private
}
