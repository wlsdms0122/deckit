//
//  StartedParams.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A run that started, with what its page reported: `summary` as a person reads it, and what it contributed.
struct StartedParams: Decodable {
    // MARK: - Property
    let mod: String
    let run: Int
    let summary: JSONValue
    let contributions: Contribution

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
