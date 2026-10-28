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
        try fixture.write("dep")
        try fixture.write("a", requires: ["dep": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        try start("dep", exportedIn: 0, runner: runner, sut: sut)
        _ = try runner.load(["a"])

        // When
        let first = try sut.begin(mod: "a", run: 1, lifecycle: 0)
        _ = try runner.started("a", run: 1)
        let second = try sut.begin(mod: "a", run: 1, lifecycle: 1)
        let reached = try sut.route(from: "a", run: 1, connection: 1)
        let back = try sut.route(from: "dep", run: 1, connection: 1)
        let stranger = Result { try sut.route(from: "b", run: 1, connection: 1) }
        let none = Result { try sut.route(from: "a", run: 1, connection: 9) }

        // Then
        #expect(first.map(\.line) == ["1 a#1@0 -> dep#1@0 required"])
        #expect(second.map(\.line) == ["2 a#1@1 -> dep#1@0 required"])
        #expect(reached == Endpoint(modId: "dep", run: 1, lifecycle: 0))
        #expect(back == Endpoint(modId: "a", run: 1, lifecycle: 0))
        #expect(throws: ConnectionError.notAnEnd(mod: "b")) { try stranger.get() }
        #expect(throws: ConnectionError.ended) { try none.get() }
        #expect(sut.changes().isEmpty)
    }

    @Test("exports opened in a lifecycle reach that lifecycle and those above, and an optional mod connects as it comes")
    func exportsReachTheirLifecycleAndAbove() throws {
        // Given
        try fixture.write("dep")
        try fixture.write("a", optional: ["dep": "1.0.0"])
        try fixture.write("old", optional: ["dep": "2.0.0"])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        for id in ["a", "old"] {
            try start(id, runner: runner, sut: sut)
            _ = try sut.begin(mod: id, run: 1, lifecycle: 1)
        }
        _ = try runner.load(["dep"])
        _ = try sut.begin(mod: "dep", run: 1, lifecycle: 0)
        _ = try runner.started("dep", run: 1)

        // When
        let before = sut.changes()
        _ = try sut.begin(mod: "dep", run: 1, lifecycle: 1)
        _ = try runner.joined("dep", run: 1, summary: .object([:]), contributions: contribution(exportedIn: 1))
        let after = sut.changes()

        // Then
        #expect(before.isEmpty)
        #expect(after.map(\.line) == ["connect 1 a#1@1 -> dep#1@1"])
    }

    @Test("a connection ends with either lifecycle, and only once")
    func connectionEndsWithEitherLifecycle() throws {
        // Given
        try fixture.write("dep")
        try fixture.write("a", optional: ["dep": "1.0.0"])
        try fixture.write("b", optional: ["dep": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        try start("dep", exportedIn: 0, runner: runner, sut: sut)
        for id in ["a", "b"] {
            try start(id, runner: runner, sut: sut)
        }
        _ = sut.changes()

        // When
        sut.end(mod: "a", run: 1, lifecycle: 0)
        let aEnded = sut.changes()
        _ = try runner.crashed("dep", run: 1, problem: "gone")
        let depCrashed = sut.changes()
        let again = sut.changes()

        // Then
        #expect(aEnded.map(\.line) == ["disconnect 1 a#1@0 -> dep#1@0"])
        #expect(depCrashed.map(\.line) == ["disconnect 2 b#1@0 -> dep#1@0"])
        #expect(again.isEmpty)
    }

    @Test("a connection its dependency's page refused is not made again while both its ends are up")
    func refusedConnectionStaysDown() throws {
        // Given
        try fixture.write("dep")
        try fixture.write("a", optional: ["dep": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        try start("a", runner: runner, sut: sut)
        try start("dep", exportedIn: 0, runner: runner, sut: sut)
        let connected = sut.changes()

        // When
        sut.refuse(1)
        let refused = sut.changes()
        _ = try runner.unload(["dep"])
        _ = try runner.stopped("dep", run: 1)
        _ = sut.changes()
        try start("dep", exportedIn: 0, runner: runner, sut: sut, run: 2)
        let relaunched = sut.changes()

        // Then
        #expect(connected.map(\.line) == ["connect 1 a#1@0 -> dep#1@0"])
        #expect(refused.isEmpty)
        #expect(relaunched.map(\.line) == ["connect 2 a#1@0 -> dep#2@0"])
    }

    @Test("a run that waits for exports in a lifecycle they do not reach is told so")
    func unreachedWaitIsAProblem() throws {
        // Given
        try fixture.write("dep")
        try fixture.write("a", optional: ["dep": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        try start("dep", exportedIn: 1, runner: runner, sut: sut)
        _ = try runner.load(["a"])
        _ = try runner.started("a", run: 1, awaits: ["dep": 0])
        let waiting = try #require(runner.run(of: "a"))

        // When
        let problems = sut.problems(of: waiting)

        // Then
        #expect(
            problems == [
                "it waits for dep in a lifecycle dep's exports do not reach: dep opens them in one stacked above"
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
