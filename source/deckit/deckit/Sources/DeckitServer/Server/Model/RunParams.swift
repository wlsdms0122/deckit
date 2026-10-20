//
//  RunParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A run of a mod, by its number.
struct RunParams: Decodable {
    // MARK: - Property
    let mod: String
    let run: Int

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
