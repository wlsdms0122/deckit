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
    let commands: [JSONValue]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
