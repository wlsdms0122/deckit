//
//  InstallReport+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

extension InstallReport: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case outcome
        case version
        case problem
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(outcome, forKey: .outcome)
        try container.encodeIfPresent(version, forKey: .version)
        try container.encodeIfPresent(problem, forKey: .problem)
    }

    // MARK: - Private
}
