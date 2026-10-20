//
//  EmitParams.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// An event the `run`th run of `mod` sends of itself, by its own name for it.
struct EmitParams: Decodable {
    // MARK: - Property
    let mod: String
    let run: Int
    let name: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
