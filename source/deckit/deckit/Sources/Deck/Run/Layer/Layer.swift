//
//  Layer.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A layer on deck that reads what the mods declared and the runs contributed for it, beside deck's own, under the keys
// of their contributes and contributions that are the layer's.
package struct Layer {
    // MARK: - Property
    // What is wrong with what `mod` declared for the layer, as the mods are read: each is recorded against the mod.
    let declarationProblems: (Mod) -> [String]
    // What is wrong with what `run` of `mod` contributed for the layer, as it starts: each is recorded against the run.
    let problems: (Run, Mod) -> [String]
    // What of the layer's own the driver is told has changed, once the runs have moved.
    let changes: () -> [any LayerChange]
    // The mod's sandbox closed, by its id: what the layer kept of its runs ends with it.
    let closed: (String) -> Void
    // The mods read again, every one found: what the layer kept of a mod not found ends with it.
    let read: ([Mod]) -> Void

    // MARK: - Initializer
    package init(
        declarationProblems: @escaping (Mod) -> [String] = { _ in [] },
        problems: @escaping (Run, Mod) -> [String] = { _, _ in [] },
        changes: @escaping () -> [any LayerChange] = { [] },
        closed: @escaping (String) -> Void = { _ in },
        read: @escaping ([Mod]) -> Void = { _ in }
    ) {
        self.declarationProblems = declarationProblems
        self.problems = problems
        self.changes = changes
        self.closed = closed
        self.read = read
    }

    // MARK: - Public
    // MARK: - Private
}
