//
//  RunTimeout+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/9/26.
//

import Foundation
import Deckit

// `{ launch, end }`, each in seconds.
extension RunTimeout: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case launch
        case end
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(launch, forKey: .launch)
        try container.encode(end, forKey: .end)
    }

    // MARK: - Private
}
