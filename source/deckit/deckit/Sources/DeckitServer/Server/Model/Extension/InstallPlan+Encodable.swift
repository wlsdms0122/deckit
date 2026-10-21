//
//  InstallPlan+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/21/26.
//

import Foundation
import Deck

extension InstallPlan: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case manifest
        case replaces
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(manifest, forKey: .manifest)
        try container.encode(replaces, forKey: .replaces)
    }

    // MARK: - Private
}
