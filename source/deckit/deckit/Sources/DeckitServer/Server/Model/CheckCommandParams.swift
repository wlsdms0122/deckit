//
//  CheckCommandParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/25/26.
//

import Foundation
import Deck

// A command by its provider, a mod's id or a host's name, and the args it is to run with, where it is to run.
struct CheckCommandParams: Decodable {
    // MARK: - Property
    let provider: String
    let command: String
    let args: JSONValue?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
