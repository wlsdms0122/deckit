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
    // A job of `id`, hosted by a page whose entry is `main.js` in a folder of its id, or by the transport connection
    // named.
    static func fixture(
        _ id: String,
        revision: String = "1",
        transport: String? = nil,
        permissions: [String] = [],
        reaches: PrincipalSet = .only([]),
        uses: [String: Int] = [:],
        provides: [String: [Int]] = [:]
    ) -> Job {
        Job(
            principal: id,
            revision: revision,
            host: transport.map(RunHost.transport) ?? .page(entry: URL(filePath: "/principals/\(id)/main.js")),
            permissions: permissions,
            reaches: reaches,
            uses: uses,
            provides: provides
        )
    }

    // MARK: - Private
}
