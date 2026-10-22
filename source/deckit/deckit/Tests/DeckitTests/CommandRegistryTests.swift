//
//  CommandRegistryTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("CommandRegistry")
struct CommandRegistryTests {
    // MARK: - Property
    private let fixture = DeckitFixture("command-registry-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("the sources are the mods whose runs registered what a person may run, in the load order")
    func sourcesAreTheRunsThatRegistered() throws {
        // Given
        try fixture.write("a")
        try fixture.write("b")
        try fixture.write("c")
        let sut = try fixture.deckit()

        // When
        _ = try sut.started("c", run: 1, contributing: ["resolve": .bool(true)])
        _ = try sut.started("b", run: 1, contributing: ["commands": .bool(false)])
        _ = try sut.started("a", run: 1, contributing: ["commands": .bool(true), "now": .bool(true)])
        let sources = sut.commands.sources()

        // Then
        let lines = sources.map { source in
            [source.id] + [("commands", source.commands), ("now", source.now), ("resolve", source.resolve)]
                .filter { _, registered in registered }
                .map { name, _ in name }
        }
        #expect(lines == [["a", "commands", "now"], ["c", "resolve"]])
        #expect(sources.first?.name == "A")
    }

    // MARK: - Private
}
