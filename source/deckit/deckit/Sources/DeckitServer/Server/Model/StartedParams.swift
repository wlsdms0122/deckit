//
//  StartedParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

// A run that started, or that runs, with what its page reported: `summary` as a person reads it, and what it
// contributes, deck's keys as deck reads them and every other key as deckit's parts read theirs.
struct StartedParams: Decodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
        case run
        case summary
        case contributions
    }

    let mod: String
    let run: Int
    let summary: JSONValue
    let contributions: Contribution
    let layers: [String: JSONValue]

    // MARK: - Initializer
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        mod = try container.decode(String.self, forKey: .mod)
        run = try container.decode(Int.self, forKey: .run)
        summary = try container.decode(JSONValue.self, forKey: .summary)
        contributions = try container.decode(Contribution.self, forKey: .contributions)
        layers = try container.decode([String: JSONValue].self, forKey: .contributions).filter { key, _ in
            key != "exportedIn" && key != "awaits"
        }
    }

    // MARK: - Public
    // MARK: - Private
}
