//
//  SeatSettings+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deckit

// `{ idleTime, asking }`, the time in seconds.
extension SeatSettings: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case idleTime
        case asking
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(idleTime, forKey: .idleTime)
        try container.encode(asking, forKey: .asking)
    }

    // MARK: - Private
}
