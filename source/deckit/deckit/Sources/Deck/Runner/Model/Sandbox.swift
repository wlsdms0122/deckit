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
    // Why it closes, once it is going: it closes once its run has ended.
    var closing: TerminateReason?
    var stopAsked = false
    // Whether it launches again once no mod asked to launch again terminates.
    var relaunching = false
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
