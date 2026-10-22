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
    // Its latest run, none until the mod first launches in it.
    var run: Run?
    // Why it closes, once it is going: it closes once its run has ended.
    var closing: TerminateReason?
    var stopAsked = false
    // What it waits for, as the driver was last told.
    var waitsFor: [String] = []
    // Its latest run's, not running before its first.
    var state: RunState {
        run?.state ?? .notRunning
    }

    // MARK: - Initializer
    init(mod: Mod) {
        self.mod = mod
    }

    // MARK: - Public
    // MARK: - Private
}
