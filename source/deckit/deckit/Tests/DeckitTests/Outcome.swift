//
//  Outcome.swift
//  DeckitTests
//
//  Created by JSilver on 11/6/26.
//

import Foundation
@testable import Deck
@testable import Deckit

// What a step comes to as the server answers it: deck's effects, then the keymap resolved anew, if it changed.
struct Outcome {
    // MARK: - Property
    let effects: [Effect]
    let keymapChange: ResolvedKeymap?
    // The first problem a run is kept or told with.
    var problem: String? {
        effects.problem
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
