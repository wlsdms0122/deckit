//
//  DeclareSettingsParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// What a run of a mod declares as its entry is read, in the order declared.
struct DeclareSettingsParams: Decodable {
    // MARK: - Property
    let mod: String
    let run: Int
    let settings: [JSONValue]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
