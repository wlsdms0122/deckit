//
//  DeckTests.swift
//  DeckTests
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("Deck")
struct DeckTests {
    // MARK: - Property
    private let fixture = RunnerFixture("deck-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("as an interface's owner changes, the runs that listen hear <interface>:owner-changed once it is reconnected")
    func ownerChangeIsDelivered() throws {
        // Given
        try fixture.write("b", provides: ["x/api": [1]])
        try fixture.write("c", provides: ["x/api": [1]])
        try fixture.write("a", uses: ["x/api": 1])
        try fixture.write("d")
        let sut = try fixture.deck()
        let started = try start("b", exportedIn: ["x/api": 0], sut: sut)
            + start("c", exportedIn: ["x/api": 0], sut: sut)
            + start("d", sut: sut)
            + start("a", sut: sut)
        sut.events.listen(mod: "a", run: 1, names: ["x/api:owner-changed"])
        sut.events.listen(mod: "d", run: 1, names: ["x/api:other"])

        // When
        try sut.catalog.pin("x/api", to: "c")
        _ = sut.readCatalog()
        let pinned = sut.reconnect()
        let again = sut.reconnect()
        try sut.catalog.pin("x/api", to: nil)
        _ = sut.readCatalog()
        let cleared = sut.reconnect()

        // Then
        #expect(!started.contains { effect in effect.line.hasPrefix("deliver") })
        #expect(
            pinned.map(\.line) == [
                "disconnect 1 a#1@0 -> b#1@0",
                "connect 2 a#1@0 -> c#1@0",
                "deliver x/api:owner-changed to a"
            ]
        )
        #expect(again.isEmpty)
        #expect(
            cleared.map(\.line) == [
                "disconnect 2 a#1@0 -> c#1@0",
                "connect 3 a#1@0 -> b#1@0",
                "deliver x/api:owner-changed to a"
            ]
        )
    }

    // MARK: - Private
    // The mod loads, begins its first lifecycle and starts, the exports for each name in `exportedIn` opened in the
    // lifecycle given. Answers the effects of its load and its start.
    private func start(_ id: String, exportedIn: [String: Int] = [:], sut: Deck) throws -> [Effect] {
        let loaded = try sut.load([id])
        _ = try sut.connections.begin(mod: id, run: 1, lifecycle: 0)
        let contributions = Contribution(exportedIn: exportedIn, awaits: [:], layers: [:])
        let started = try sut.started(id, run: 1, summary: .object([:]), contributions: contributions)

        return loaded + started
    }
}
