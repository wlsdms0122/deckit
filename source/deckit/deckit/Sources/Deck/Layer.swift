//
//  Layer.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A layer on deck that reads what the runs contributed for it, beside deck's own, under the keys of their
// contributions that are the layer's.
public protocol Layer: AnyObject {
    // What is wrong with what `run` of `mod` contributed for the layer, as it starts: each is recorded against the run.
    func problems(of run: Run, mod: Mod) -> [String]
    // What of the layer's own the driver is told has changed, once the runs have moved: each an effect, by its name, and
    // what it carries.
    func changes() -> [(effect: String, change: any Encodable & Sendable)]
}
