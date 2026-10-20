//
//  ListSettingsParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The mods' computed choices, with the options their pages worked out.
struct ListSettingsParams: Decodable {
    // MARK: - Property
    let choices: [ComputedChoice]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
