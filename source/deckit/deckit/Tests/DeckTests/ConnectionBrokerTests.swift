//
//  ConnectionBrokerTests.swift
//  DeckTests
//
//  Created by JSilver on 10/28/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("ConnectionBroker")
struct ConnectionBrokerTests {
    // MARK: - Property
    private let fixture = RunnerFixture("connection-broker-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("each lifecycle that begins connects to the exports of a mod it requires, and a message on it goes to the other end")
    func beginningLifecycleConnects() throws {
        // Given
        try fixture.write("forge")
        try fixture.write("bot", requires: ["forge": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        try start("forge", exportedIn: 0, runner: runner, sut: sut)
        _ = try runner.load(["bot"])

        // When
        let first = try sut.begin(mod: "bot", run: 1, lifecycle: 0)
        _ = try runner.started("bot", run: 1)
        let second = try sut.begin(mod: "bot", run: 1, lifecycle: 1)
        let reached = try sut.route(from: "bot", run: 1, connection: 1)
        let back = try sut.route(from: "forge", run: 1, connection: 1)
        let stranger = Result { try sut.route(from: "note", run: 1, connection: 1) }
        let none = Result { try sut.route(from: "bot", run: 1, connection: 9) }

        // Then
        #expect(first.map(\.line) == ["1 bot#1@0 -> forge#1@0 required"])
        #expect(second.map(\.line) == ["2 bot#1@1 -> forge#1@0 required"])
        #expect(reached == Endpoint(modId: "forge", run: 1, lifecycle: 0))
        #expect(back == Endpoint(modId: "bot", run: 1, lifecycle: 0))
        #expect(throws: ConnectionError.notAnEnd(mod: "note")) { try stranger.get() }
        #expect(throws: ConnectionError.ended) { try none.get() }
        #expect(sut.changes().isEmpty)
    }

    @Test("exports opened in a lifecycle reach that lifecycle and those above, and an optional mod connects as it comes")
    func exportsReachTheirLifecycleAndAbove() throws {
        // Given
        try fixture.write("switcher")
        try fixture.write("note", optional: ["switcher": "1.0.0"])
        try fixture.write("old", optional: ["switcher": "2.0.0"])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        for id in ["note", "old"] {
            try start(id, runner: runner, sut: sut)
            _ = try sut.begin(mod: id, run: 1, lifecycle: 1)
        }
        _ = try runner.load(["switcher"])
        _ = try sut.begin(mod: "switcher", run: 1, lifecycle: 0)
        _ = try runner.started("switcher", run: 1)

        // When
        let before = sut.changes()
        _ = try sut.begin(mod: "switcher", run: 1, lifecycle: 1)
        _ = try runner.joined("switcher", run: 1, summary: .object([:]), contributions: contribution(exportedIn: 1))
        let after = sut.changes()

        // Then
        #expect(before.isEmpty)
        #expect(after.map(\.line) == ["connect 1 note#1@1 -> switcher#1@1"])
    }

    @Test("a connection ends with either lifecycle, and only once")
    func connectionEndsWithEitherLifecycle() throws {
        // Given
        try fixture.write("switcher")
        try fixture.write("note", optional: ["switcher": "1.0.0"])
        try fixture.write("finder", optional: ["switcher": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        try start("switcher", exportedIn: 0, runner: runner, sut: sut)
        for id in ["note", "finder"] {
            try start(id, runner: runner, sut: sut)
        }
        _ = sut.changes()

        // When
        sut.end(mod: "note", run: 1, lifecycle: 0)
        let noteEnded = sut.changes()
        _ = try runner.crashed("switcher", run: 1, problem: "gone")
        let switcherCrashed = sut.changes()
        let again = sut.changes()

        // Then
        #expect(noteEnded.map(\.line) == ["disconnect 1 note#1@0 -> switcher#1@0"])
        #expect(switcherCrashed.map(\.line) == ["disconnect 2 finder#1@0 -> switcher#1@0"])
        #expect(again.isEmpty)
    }

    @Test("a connection its dependency's page refused is not made again while both its ends are up")
    func refusedConnectionStaysDown() throws {
        // Given
        try fixture.write("calendar")
        try fixture.write("google", optional: ["calendar": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        try start("google", runner: runner, sut: sut)
        try start("calendar", exportedIn: 0, runner: runner, sut: sut)
        let connected = sut.changes()

        // When
        sut.refuse(1)
        let refused = sut.changes()
        _ = try runner.unload(["calendar"])
        _ = try runner.stopped("calendar", run: 1)
        _ = sut.changes()
        try start("calendar", exportedIn: 0, runner: runner, sut: sut, run: 2)
        let relaunched = sut.changes()

        // Then
        #expect(connected.map(\.line) == ["connect 1 google#1@0 -> calendar#1@0"])
        #expect(refused.isEmpty)
        #expect(relaunched.map(\.line) == ["connect 2 google#1@0 -> calendar#2@0"])
    }

    @Test("a run that waits for exports in a lifecycle they do not reach is told so")
    func unreachedWaitIsAProblem() throws {
        // Given
        try fixture.write("switcher")
        try fixture.write("note", optional: ["switcher": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        try start("switcher", exportedIn: 1, runner: runner, sut: sut)
        _ = try runner.load(["note"])
        _ = try runner.started("note", run: 1, awaits: ["switcher": 0])
        let note = try #require(runner.run(of: "note"))

        // When
        let problems = sut.problems(of: note)

        // Then
        #expect(
            problems == [
                "it waits for switcher in a lifecycle switcher's exports do not reach: switcher opens them in one stacked above"
            ]
        )
    }

    // MARK: - Private
    // The mod launches, begins its first lifecycle and starts, its exports opened in the lifecycle `exports`, if any.
    private func start(
        _ id: String,
        exportedIn: Int? = nil,
        runner: Runner,
        sut: ConnectionBroker,
        run: Int = 1
    ) throws {
        _ = try runner.load([id])
        _ = try sut.begin(mod: id, run: run, lifecycle: 0)
        _ = try runner.started(id, run: run, exportedIn: exportedIn)
    }

    private func contribution(exportedIn: Int?) -> Contribution {
        Contribution(exportedIn: exportedIn, awaits: [:], layers: [:])
    }
}
