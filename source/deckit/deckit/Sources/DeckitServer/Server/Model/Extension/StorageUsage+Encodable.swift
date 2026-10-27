//
//  StorageUsage+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/21/26.
//

import Foundation
import Deck

extension StorageUsage: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case data
        case records
        case kept
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(data, forKey: .data)
        try container.encode(records, forKey: .records)
        try container.encode(kept, forKey: .kept)
    }

    // MARK: - Private
}
