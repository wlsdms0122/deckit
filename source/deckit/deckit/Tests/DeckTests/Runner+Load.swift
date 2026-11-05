//
//  Runner+Load.swift
//  DeckTests
//
//  Created by JSilver on 11/6/26.
//

import Foundation
@testable import Deck

extension Runner {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // The mods named load, as the person opens them.
    func load(_ ids: [String]) throws -> [Effect] {
        try load(ids.map { id in LaunchRequest(modId: id, origin: .person) })
    }

    // MARK: - Private
}
