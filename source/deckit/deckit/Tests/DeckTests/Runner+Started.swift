//
//  Runner+Started.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
@testable import Deck

extension Runner {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // It started, its exports opened in the lifecycle `exports`, if any, and waiting for the mods in `awaits` from the
    // lifecycles given.
    func started(_ id: String, run number: Int, exportedIn: Int? = nil, awaits: [String: Int] = [:]) throws -> [Effect] {
        let contributions = Contribution(exportedIn: exportedIn, awaits: awaits, layers: [:])

        return try started(id, run: number, summary: .object([:]), contributions: contributions)
    }

    // MARK: - Private
}
