//
//  Contribution+Codable.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// One object, of which deck reads its own keys only.
extension Contribution: Codable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case exportedIn
        case awaits
    }

    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        exportedIn = try container.decodeIfPresent([String: Int].self, forKey: .exportedIn) ?? [:]
        awaits = try container.decode([String: Int].self, forKey: .awaits)
    }

    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(exportedIn, forKey: .exportedIn)
        try container.encode(awaits, forKey: .awaits)
    }

    // MARK: - Private
}
