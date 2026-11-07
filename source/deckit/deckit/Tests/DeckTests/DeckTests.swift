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
    private let sut = Deck(
        home: FileManager.default.temporaryDirectory.appending(path: "deck-tests-\(UUID().uuidString)")
    )

    // MARK: - Initializer
    // MARK: - Test
    @Test("as an interface's owner changes, the runs that listen hear <interface>:owner-changed once it is reconnected")
    func ownerChangeIsDelivered() throws {
        // Given
        let b = Job.fixture("b", provides: ["x/api": [1]])
        let c = Job.fixture("c", provides: ["x/api": [1]])
        let a = Job.fixture("a", uses: ["x/api": 1])
        let d = Job.fixture("d")
        sut.owners.provide([b, c, a, d], keeping: [])
        let started = try start(b, exportedIn: ["x/api": 0]) + start(c, exportedIn: ["x/api": 0]) + start(d) + start(a)
        sut.events.listen(mod: "a", run: 1, names: ["x/api:owner-changed"])
        sut.events.listen(mod: "d", run: 1, names: ["x/api:other"])

        // When
        try sut.owners.pin("x/api", to: "c")
        let pinned = sut.reconnect()
        let again = sut.reconnect()
        try sut.owners.pin("x/api", to: nil)
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

    @Test("a lifecycle that asks to reach a mod by id is told it waits, then connects as the mod runs, until released")
    func reachIsAnswered() throws {
        // Given
        _ = try start(.fixture("a", reaches: .only(["dep"])))

        // When
        let asked = try sut.reach("dep", from: "a", run: 1, lifecycle: 0)
        let started = try start(.fixture("dep"), exportedIn: ["dep": 0])
        let released = sut.release("dep", from: "a", run: 1, lifecycle: 0)

        // Then
        #expect(asked.map(\.line) == ["wait a#1@0 for dep by dep"])
        #expect(started.map(\.line).filter { line in line.hasPrefix("connect") } == ["connect 1 a#1@0 -> dep#1@0"])
        #expect(released.map(\.line) == ["disconnect 1 a#1@0 -> dep#1@0"])
    }

    // MARK: - Private
    // The job loads, begins its first lifecycle and starts, the exports for each name in `exportedIn` opened in the
    // lifecycle given. Answers the effects of its load and its start.
    private func start(_ job: Job, exportedIn: [String: Int] = [:]) throws -> [Effect] {
        let loaded = try sut.load([job])
        _ = try sut.connections.begin(mod: job.modId, run: 1, lifecycle: 0)
        let contributions = Contribution(exportedIn: exportedIn, awaits: [:])
        let started = try sut.started(job.modId, run: 1, contributions: contributions)

        return loaded + started
    }
}
