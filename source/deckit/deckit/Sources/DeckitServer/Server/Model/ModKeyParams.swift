//
//  ModKeyParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// One of a mod's keys: a record's, or a setting's.
struct ModKeyParams: Decodable {
    // MARK: - Property
    let mod: String
    let key: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
