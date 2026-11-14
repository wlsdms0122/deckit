//
//  AdmissionAnswer+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deckit

extension AdmissionAnswer: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case effects
        case seat
        case asking
    }

    private enum AskingKeys: String, CodingKey {
        case user
    }

    // MARK: - Initializer
    // MARK: - Public
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(effects, forKey: .effects)
        try container.encodeIfPresent(seat, forKey: .seat)
        if let asking {
            var nested = container.nestedContainer(keyedBy: AskingKeys.self, forKey: .asking)
            try nested.encode(asking, forKey: .user)
        }
    }

    // MARK: - Private
}
