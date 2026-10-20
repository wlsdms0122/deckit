//
//  Deckit+JSON.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
import Deck
@testable import Deckit

extension Deckit {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // What deckit answers `method`, as the driver reads it.
    func json(_ method: String, _ params: JSONValue = .object([:])) throws -> JSONValue {
        let answered = try #require(try answer(Call(method: method, params: params)))
        return try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(answered))
    }

    // The effects of the `run`th run of `mod` started, having contributed `keys`.
    func started(_ mod: String, run: Int, keys: [JSONValue]) throws -> JSONValue {
        try started(mod, run: run, contributing: ["keys": .array(keys)])
    }

    // The effects of the `run`th run of `mod` started, having contributed `layers` beside deck's own.
    func started(_ mod: String, run: Int, contributing layers: [String: JSONValue]) throws -> JSONValue {
        try json(
            "runner/started",
            .object([
                "mod": .string(mod),
                "run": .number(Double(run)),
                "summary": .object([:]),
                "contributions": .object(
                    layers.merging([
                        "exports": .object(["values": .string("{}"), "functions": .array([])]),
                        "extensionPoints": .array([]),
                        "extensions": .object([:])
                    ]) { layer, _ in layer }
                )
            ])
        )
    }

    // MARK: - Private
}
