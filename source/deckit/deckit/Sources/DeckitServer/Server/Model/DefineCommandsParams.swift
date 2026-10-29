//
//  DefineCommandsParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/25/26.
//

import Foundation
import Deck

// A host's commands as declared, under `provider`, its name.
struct DefineCommandsParams: Decodable {
    // MARK: - Property
    let provider: String
    // The host's, as a person reads it.
    let name: String
    let commands: [JSONValue]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
