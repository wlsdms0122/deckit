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
    // The effects of the `run`th run of `mod` started, having contributed `keys` and the commands they run, each
    // labeled by its name.
    func started(_ mod: String, run: Int, keys: [JSONValue]) throws -> [Effect] {
        let names = keys.compactMap { key in if case let .object(key) = key { key["command"] } else { nil } }
        let commands = names.map { name in JSONValue.object(["name": name, "label": name]) }
        return try started(mod, run: run, contributing: ["keys": .array(keys), "commands": .array(commands)])
    }

    // The effects of the `run`th run of `mod` started, having contributed `layers` beside deck's own.
    func started(_ mod: String, run: Int, contributing layers: [String: JSONValue]) throws -> [Effect] {
        let contributions = Contribution(
            exports: Snapshot(values: "{}", functions: []),
            extensionPoints: [],
            extensions: [:],
            layers: layers
        )
        return try deck.started(mod, run: run, summary: .object([:]), contributions: contributions)
    }

    // MARK: - Private
}
