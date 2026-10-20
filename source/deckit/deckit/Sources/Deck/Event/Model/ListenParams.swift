//
//  ListenParams.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Every scoped event name the `run`th run of `mod` listens to now.
struct ListenParams: Decodable {
    // MARK: - Property
    let mod: String
    let run: Int
    let names: [String]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
