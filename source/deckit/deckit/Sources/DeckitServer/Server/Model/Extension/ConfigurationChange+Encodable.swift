//
//  ConfigurationChange+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

extension ConfigurationChange: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case value
        case changed
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(value, forKey: .value)
        try container.encode(changed, forKey: .changed)
    }

    // MARK: - Private
}
