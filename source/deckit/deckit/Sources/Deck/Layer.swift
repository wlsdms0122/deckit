//
//  Layer.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A layer on deck that reads what the runs contributed for it, beside deck's own, under the keys of their
// contributions that are the layer's.
public struct Layer {
    // MARK: - Property
    // What is wrong with what `run` of `mod` contributed for the layer, as it starts: each is recorded against the run.
    let problems: (Run, Mod) -> [String]
    // What of the layer's own the driver is told has changed, once the runs have moved.
    let changes: () -> [any LayerChange]

    // MARK: - Initializer
    public init(problems: @escaping (Run, Mod) -> [String], changes: @escaping () -> [any LayerChange] = { [] }) {
        self.problems = problems
        self.changes = changes
    }

    // MARK: - Public
    // MARK: - Private
}
