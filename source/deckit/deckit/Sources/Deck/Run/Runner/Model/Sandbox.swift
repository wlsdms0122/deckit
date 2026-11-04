//
//  Sandbox.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Where a mod runs, run after run, until the mod goes or its code changes.
final class Sandbox {
    // MARK: - Property
    let mod: Mod
    // Its latest run.
    var run: Run
    // The interfaces its latest run requires, each with the mod picked for it as the run launched: the run ends before
    // any of those.
    var requires: [Relation] = []
    var stopAsked = false
    var state: RunState {
        run.state
    }

    // MARK: - Initializer
    init(mod: Mod, run: Run) {
        self.mod = mod
        self.run = run
    }

    // MARK: - Public
    // MARK: - Private
}
