//
//  InitializeParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

struct InitializeParams: Decodable {
    // MARK: - Property
    // Deckit's folder, as the host app configured it.
    let home: String
    // The mod contract the mods are run with.
    let api: Version
    // The mods the app ships, each its folder and whether the host names it a system mod.
    let ship: [ShippedMod]
    // The folders of the mods read in place.
    let sources: [String]
    // Those the layers the driver runs define, beside deckit's own.
    let permissions: [Permission]
    // The manifest fields the layers the driver runs add.
    let fields: [String]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
