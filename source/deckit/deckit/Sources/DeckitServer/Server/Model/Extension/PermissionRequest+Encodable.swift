//
//  PermissionRequest+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The permission's fields and its reason, side by side.
extension PermissionRequest: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case reason
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        try permission.encode(to: encoder)
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(reason, forKey: .reason)
    }

    // MARK: - Private
}
