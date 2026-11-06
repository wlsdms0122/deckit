//
//  MintTokenParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck
import Deckit

// A command of the mod's own, by name, and the args a token of it runs it with.
struct MintTokenParams: Decodable {
    // MARK: - Property
    let mod: String
    let command: String
    let args: JSONValue?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
