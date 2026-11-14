//
//  IdleRule+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deckit

// `{ idleTime }`, in seconds.
extension IdleRule: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case idleTime
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(time, forKey: .idleTime)
    }

    // MARK: - Private
}
