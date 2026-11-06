//
//  Job+Fixture.swift
//  DeckTests
//
//  Created by JSilver on 11/6/26.
//

import Foundation
@testable import Deck

extension Job {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // A job of `id`, its entry `main.js` in a folder of its id, granted no permission.
    static func fixture(
        _ id: String,
        revision: String = "1",
        reaches: [String] = [],
        uses: [String: Int] = [:],
        provides: [String: [Int]] = [:]
    ) -> Job {
        Job(
            modId: id,
            revision: revision,
            entry: URL(filePath: "/mods/\(id)/main.js"),
            permissions: [],
            reaches: reaches,
            uses: uses,
            provides: provides
        )
    }

    // MARK: - Private
}
