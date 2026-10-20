//
//  CommandRegistryTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
import Deck
@testable import Deckit

@Suite("CommandRegistry")
struct CommandRegistryTests {
    // MARK: - Property
    private let mods = ModHome("command-registry-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("the sources are the mods whose runs registered what a person may run, in the mods' order")
    func testThatSourcesAreTheRunsThatRegistered() throws {
        // Given
        try mods.write("a")
        try mods.write("b")
        try mods.write("c")
        let sut = try mods.deckit()

        // When
        _ = try sut.started("c", run: 1, contributing: ["resolve": .bool(true)])
        _ = try sut.started("b", run: 1, contributing: ["commands": .bool(false)])
        _ = try sut.started("a", run: 1, contributing: ["commands": .bool(true), "now": .bool(true)])
        let sources = try sut.json("command/sources")

        // Then
        let lines = sources.array.map { source in
            [source["id"]?.string ?? ""] + ["commands", "now", "resolve"].filter { name in source[name]?.bool == true }
        }
        #expect(lines == [["a", "commands", "now"], ["c", "resolve"]])
        #expect(sources.array.first?["name"]?.string == "A")
    }

    // MARK: - Private
}
