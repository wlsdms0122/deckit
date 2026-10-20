//
//  Runner+Started.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
@testable import Deck

extension Runner {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // It started, exporting functions at `exports` and opening `extensionPoints`, and extending each point in
    // `extensions` with functions at the paths given.
    func started(
        _ id: String,
        run number: Int,
        exports: [[String]] = [],
        extensionPoints: [String] = [],
        extensions: [String: [[String]]] = [:]
    ) throws -> [Effect] {
        let contributions = Contribution(
            exports: Snapshot(values: #"{"id":"\#(id)"}"#, functions: exports),
            extensionPoints: extensionPoints,
            extensions: extensions.mapValues { functions in Snapshot(values: "{}", functions: functions) },
            layers: [:]
        )

        return try started(id, run: number, summary: .object([:]), contributions: contributions)
    }

    // MARK: - Private
}
