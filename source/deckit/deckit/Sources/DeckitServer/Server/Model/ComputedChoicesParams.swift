//
//  ComputedChoicesParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The mod whose computed choices are asked for, or none for every mod's.
struct ComputedChoicesParams: Decodable {
    // MARK: - Property
    let mod: String?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
