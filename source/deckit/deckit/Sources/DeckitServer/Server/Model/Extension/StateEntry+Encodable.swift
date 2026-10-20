//
//  StateEntry+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension StateEntry: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case folder
        case key
        case text
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(folder, forKey: .folder)
        try container.encode(key, forKey: .key)
        try container.encode(text, forKey: .text)
    }

    // MARK: - Private
}
