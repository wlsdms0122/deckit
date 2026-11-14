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
    // It started, its exports for each name in `exportedIn` opened in the lifecycle given, and waiting for the exports
    // it reaches by the names in `awaits` from the lifecycles given.
    func started(
        _ id: String,
        run number: Int,
        exportedIn: [String: Int] = [:],
        awaits: [String: Int] = [:]
    ) throws -> [Effect] {
        try started(id, run: number, contributions: Contribution(exportedIn: exportedIn, awaits: awaits))
    }

    // MARK: - Private
}
