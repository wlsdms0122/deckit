//
//  InitializeParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

struct InitializeParams: Decodable {
    // MARK: - Property
    // Deckit's folder, as the host app configured it.
    let home: String
    // The app's, as a person reads it.
    let name: String
    // By scheme, the mods the app asks first to open an address.
    let schemeHandlers: [String: [String]]
    // The mod contract the mods are run with.
    let api: Version
    // The folders of the mods the app ships, and of those read in place.
    let ship: [String]
    let sources: [String]
    // Those the layers on deck guard what they add with, deck's own among them, in the order they were defined.
    let permissions: [Permission]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
