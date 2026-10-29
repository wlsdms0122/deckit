//
//  Layer.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A layer on deck that reads what the runs contributed for it, beside deck's own, under the keys of their
// contributions that are the layer's.
package struct Layer {
    // MARK: - Property
    // What is wrong with what `run` of `mod` contributed for the layer, as it starts: each is recorded against the run.
    let problems: (Run, Mod) -> [String]
    // What of the layer's own the driver is told has changed, once the runs have moved.
    let changes: () -> [any LayerChange]
    // The mod's sandbox closed, by its id: what the layer kept of its runs ends with it.
    let closed: (String) -> Void

    // MARK: - Initializer
    package init(
        problems: @escaping (Run, Mod) -> [String] = { _, _ in [] },
        changes: @escaping () -> [any LayerChange] = { [] },
        closed: @escaping (String) -> Void = { _ in }
    ) {
        self.problems = problems
        self.changes = changes
        self.closed = closed
    }

    // MARK: - Public
    // MARK: - Private
}
