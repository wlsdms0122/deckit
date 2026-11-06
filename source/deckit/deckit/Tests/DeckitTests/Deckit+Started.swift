//
//  Deckit+Started.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
@testable import Deck
@testable import Deckit

extension Deckit {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // What the `run`th run of `mod` started comes to, having contributed `keys`.
    func started(_ mod: String, run: Int, keys: [JSONValue]) throws -> Outcome {
        try started(mod, run: run, contributing: ["keys": .array(keys)])
    }

    // What the `run`th run of `mod` started comes to, having contributed `layers` beside deck's own.
    func started(_ mod: String, run: Int, contributing layers: [String: JSONValue]) throws -> Outcome {
        let contributions = Contribution(exportedIn: [:], awaits: [:])
        return outcome(try started(mod, run: run, summary: .object([:]), contributions: contributions, layers: layers))
    }

    // `effects` and the keymap resolved anew, as the server answers them.
    func outcome(_ effects: [Effect]) -> Outcome {
        Outcome(effects: effects, keymapChange: keymap.changes().last)
    }

    // MARK: - Private
}
