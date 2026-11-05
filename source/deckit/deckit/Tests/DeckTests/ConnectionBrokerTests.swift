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
    @Test("a lifecycle that begins connects to the exports of the mods it requires, and a message goes across")
    func beginningLifecycleConnects() throws {
        // Given
        try fixture.write("dep")
        try fixture.write("a", requires: ["dep": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        try start("dep", exportedIn: ["dep": 0], runner: runner, sut: sut)
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

    @Test("exports opened in a lifecycle reach it and those above, and a user of the major the owner provides connects")
    func exportsReachTheirLifecycleAndAbove() throws {
        // Given
        try fixture.write("dep", provides: ["dep/api": [1, 2]])
        try fixture.write("a", uses: ["dep/api": 1])
        try fixture.write("old", uses: ["dep/api": 0])
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
        _ = try runner.joined(
            "dep",
            run: 1,
            summary: .object([:]),
            contributions: contribution(exportedIn: ["dep/api": 1])
        )
        let after = sut.changes()

        // Then
        #expect(before.isEmpty)
        #expect(after.map(\.line) == ["connect 1 a#1@1 -> dep#1@1"])
    }

    @Test("a mod named in [dependencies] connects at a version taken, by the exports it opened for its id")
    func idDependencyConnectsAtItsVersion() throws {
        // Given
        try fixture.write("dep", version: "1.2.0", provides: ["dep/api": [1]])
        try fixture.write("a", optional: ["dep": "1.0.0"])
        try fixture.write("newer", optional: ["dep": "2.0.0"])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        for id in ["a", "newer"] {
            try start(id, runner: runner, sut: sut)
        }

        // When
        try start("dep", exportedIn: ["dep/api": 0], runner: runner, sut: sut)
        let interfaceOnly = sut.changes()
        _ = try runner.joined("dep", run: 1, summary: .object([:]), contributions: contribution(exportedIn: ["dep": 0]))
        let opened = sut.changes()

        // Then
        #expect(interfaceOnly.isEmpty)
        #expect(opened.map(\.line) == ["connect 1 a#1@0 -> dep#1@0"])
    }

    @Test("a mod that owns an interface it uses reaches no one by it")
    func ownerUsingItsInterfaceReachesNoOne() throws {
        // Given
        try fixture.write("a", provides: ["x/api": [1]], uses: ["x/api": 1])
        try fixture.write("b", provides: ["x/api": [1]])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)

        // When
        try start("b", exportedIn: ["x/api": 0], runner: runner, sut: sut)
        try start("a", exportedIn: ["x/api": 0], runner: runner, sut: sut)

        // Then
        #expect(sut.changes().isEmpty)
        #expect(sut.provider(of: "x/api", for: "a") == nil)
    }

    @Test("a connection ends with either lifecycle, and only once")
    func connectionEndsWithEitherLifecycle() throws {
        // Given
        try fixture.write("dep", provides: ["dep/api": [1]])
        try fixture.write("a", uses: ["dep/api": 1])
        try fixture.write("b", uses: ["dep/api": 1])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        try start("dep", exportedIn: ["dep/api": 0], runner: runner, sut: sut)
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
        try fixture.write("dep", provides: ["dep/api": [1]])
        try fixture.write("a", uses: ["dep/api": 1])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        try start("a", runner: runner, sut: sut)
        try start("dep", exportedIn: ["dep/api": 0], runner: runner, sut: sut)
        let connected = sut.changes()

        // When
        sut.refuse(1)
        let refused = sut.changes()
        _ = try runner.unload(["dep"])
        _ = try runner.stopped("dep", run: 1)
        _ = sut.changes()
        try start("dep", exportedIn: ["dep/api": 0], runner: runner, sut: sut, run: 2)
        let relaunched = sut.changes()

        // Then
        #expect(connected.map(\.line) == ["connect 1 a#1@0 -> dep#1@0"])
        #expect(refused.isEmpty)
        #expect(relaunched.map(\.line) == ["connect 2 a#1@0 -> dep#2@0"])
    }

    @Test("a run that waits for exports in a lifecycle they do not reach is told so")
    func unreachedWaitIsAProblem() throws {
        // Given
        try fixture.write("dep", provides: ["dep/api": [1]])
        try fixture.write("a", uses: ["dep/api": 1])
        let runner = try fixture.runner()
        let sut = ConnectionBroker(runner: runner)
        try start("dep", exportedIn: ["dep/api": 1], runner: runner, sut: sut)
        _ = try runner.load(["a"])
        _ = try runner.started("a", run: 1, awaits: ["dep/api": 0])
        let waiting = try #require(runner.run(of: "a"))

        // When
        let problems = sut.problems(of: waiting)

        // Then
        #expect(
            problems == [
                "it waits for dep/api in a lifecycle its exports do not reach: they are opened in one stacked above"
            ]
        )
    }

    @Test("as an interface's owner changes, the connection to the old owner ends and the new owner connects")
    func ownerChangeConnectsTheNewOwner() throws {
        // Given
        try fixture.write("b", provides: ["x/api": [1]])
        try fixture.write("c", provides: ["x/api": [1]])
        try fixture.write("d", provides: ["x/api": [1]])
        try fixture.write("a", uses: ["x/api": 1])
        let catalog = try fixture.catalog()
        let runner = Runner(catalog: catalog)
        let sut = ConnectionBroker(runner: runner)
        for id in ["b", "c", "d"] {
            try start(id, exportedIn: ["x/api": 0], runner: runner, sut: sut)
        }
        _ = try runner.load(["a"])
        let connected = try sut.begin(mod: "a", run: 1, lifecycle: 0)
        _ = try runner.started("a", run: 1)

        // When
        try catalog.pin("x/api", to: "c")
        let unread = sut.changes()
        _ = catalog.read()
        let pinned = sut.changes()
        try catalog.pin("x/api", to: nil)
        _ = catalog.read()
        let cleared = sut.changes()
        try fixture.remove("b")
        _ = catalog.read()
        let removed = sut.changes()
        let again = sut.changes()

        // Then
        #expect(connected.map(\.line) == ["1 a#1@0 -> b#1@0"])
        #expect(unread.isEmpty)
        #expect(pinned.map(\.line) == ["disconnect 1 a#1@0 -> b#1@0", "connect 2 a#1@0 -> c#1@0"])
        #expect(cleared.map(\.line) == ["disconnect 2 a#1@0 -> c#1@0", "connect 3 a#1@0 -> b#1@0"])
        #expect(removed.map(\.line) == ["disconnect 3 a#1@0 -> b#1@0", "connect 4 a#1@0 -> c#1@0"])
        #expect(again.isEmpty)
    }

    @Test("an owner that does not provide the major a mod uses is as none to it, and another owner that does connects")
    func ownerOfAnotherMajorDoesNotConnect() throws {
        // Given
        try fixture.write("b", provides: ["x/api": [2]])
        try fixture.write("c", provides: ["x/api": [1, 2]])
        try fixture.write("a", uses: ["x/api": 1])
        let catalog = try fixture.catalog()
        let runner = Runner(catalog: catalog)
        let sut = ConnectionBroker(runner: runner)
        for id in ["b", "c"] {
            try start(id, exportedIn: ["x/api": 0], runner: runner, sut: sut)
        }

        // When
        try start("a", runner: runner, sut: sut)
        let unspoken = sut.changes()
        try catalog.pin("x/api", to: "c")
        _ = catalog.read()
        let spoken = sut.changes()

        // Then
        #expect(unspoken.isEmpty)
        #expect(spoken.map(\.line) == ["connect 1 a#1@0 -> c#1@0"])
    }

    // MARK: - Private
    // The mod launches, begins its first lifecycle and starts, the exports for each name in `exportedIn` opened in the
    // lifecycle given.
    private func start(
        _ id: String,
        exportedIn: [String: Int] = [:],
        runner: Runner,
        sut: ConnectionBroker,
        run: Int = 1
    ) throws {
        _ = try runner.load([id])
        _ = try sut.begin(mod: id, run: run, lifecycle: 0)
        _ = try runner.started(id, run: run, exportedIn: exportedIn)
    }

    private func contribution(exportedIn: [String: Int]) -> Contribution {
        Contribution(exportedIn: exportedIn, awaits: [:], layers: [:])
    }
}
