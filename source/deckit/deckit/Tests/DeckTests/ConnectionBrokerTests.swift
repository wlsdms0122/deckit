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
    private let runner = Runner()
    private let owners = OwnerTable.fixture("connection-broker-tests")
    private let sut: ConnectionBroker

    // MARK: - Initializer
    init() {
        sut = ConnectionBroker(runner: runner, owners: owners)
    }

    // MARK: - Test
    @Test("a lifecycle that begins connects to the exports of the mods it reaches by id, and a message goes across")
    func beginningLifecycleConnects() throws {
        // Given
        let a = Job.fixture("a", reaches: ["dep"])
        try start(.fixture("dep"), exportedIn: ["dep": 0])
        _ = try runner.load([a])

        // When
        let first = try sut.begin(mod: "a", run: 1, lifecycle: 0)
        _ = try runner.started("a", run: 1)
        let second = try sut.begin(mod: "a", run: 1, lifecycle: 1)
        let reached = try sut.route(from: "a", run: 1, connection: 1)
        let back = try sut.route(from: "dep", run: 1, connection: 1)
        let stranger = Result { try sut.route(from: "b", run: 1, connection: 1) }
        let none = Result { try sut.route(from: "a", run: 1, connection: 9) }

        // Then
        #expect(first.map(\.line) == ["1 a#1@0 -> dep#1@0"])
        #expect(second.map(\.line) == ["2 a#1@1 -> dep#1@0"])
        #expect(reached == Endpoint(modId: "dep", run: 1, lifecycle: 0))
        #expect(back == Endpoint(modId: "a", run: 1, lifecycle: 0))
        #expect(throws: ConnectionError.notAnEnd(mod: "b")) { try stranger.get() }
        #expect(throws: ConnectionError.ended) { try none.get() }
        #expect(sut.changes().isEmpty)
    }

    @Test("exports opened in a lifecycle reach it and those above, and a user of the major the owner provides connects")
    func exportsReachTheirLifecycleAndAbove() throws {
        // Given
        let dep = Job.fixture("dep", provides: ["dep/api": [1, 2]])
        let jobs = [dep, .fixture("a", uses: ["dep/api": 1]), .fixture("old", uses: ["dep/api": 0])]
        owners.provide(jobs, keeping: [])
        for job in jobs.dropFirst() {
            try start(job)
            _ = try sut.begin(mod: job.modId, run: 1, lifecycle: 1)
        }
        _ = try runner.load([dep])
        _ = try sut.begin(mod: "dep", run: 1, lifecycle: 0)
        _ = try runner.started("dep", run: 1)

        // When
        let before = sut.changes()
        _ = try sut.begin(mod: "dep", run: 1, lifecycle: 1)
        _ = try runner.joined("dep", run: 1, contributions: Contribution(exportedIn: ["dep/api": 1], awaits: [:]))
        let after = sut.changes()

        // Then
        #expect(before.isEmpty)
        #expect(after.map(\.line) == ["connect 1 a#1@1 -> dep#1@1"])
    }

    @Test("a mod reached by id connects by the exports it opened for its id, not those of an interface it provides")
    func idReachConnectsByTheIdsExports() throws {
        // Given
        let dep = Job.fixture("dep", provides: ["dep/api": [1]])
        owners.provide([dep], keeping: [])
        try start(.fixture("a", reaches: ["dep"]))

        // When
        try start(dep, exportedIn: ["dep/api": 0])
        let interfaceOnly = sut.changes()
        _ = try runner.joined("dep", run: 1, contributions: Contribution(exportedIn: ["dep": 0], awaits: [:]))
        let opened = sut.changes()

        // Then
        #expect(interfaceOnly.isEmpty)
        #expect(opened.map(\.line) == ["connect 1 a#1@0 -> dep#1@0"])
    }

    @Test("a mod that owns an interface it uses reaches no one by it")
    func ownerUsingItsInterfaceReachesNoOne() throws {
        // Given
        let a = Job.fixture("a", uses: ["x/api": 1], provides: ["x/api": [1]])
        let b = Job.fixture("b", provides: ["x/api": [1]])
        owners.provide([a, b], keeping: [])

        // When
        try start(b, exportedIn: ["x/api": 0])
        try start(a, exportedIn: ["x/api": 0])

        // Then
        #expect(sut.changes().isEmpty)
        #expect(sut.provider(of: "x/api", for: "a") == nil)
    }

    @Test("a connection ends with either lifecycle, and only once, and one left reaching a mod that ended waits")
    func connectionEndsWithEitherLifecycle() throws {
        // Given
        let jobs = [
            Job.fixture("dep", provides: ["dep/api": [1]]),
            .fixture("a", uses: ["dep/api": 1]),
            .fixture("b", uses: ["dep/api": 1])
        ]
        owners.provide(jobs, keeping: [])
        try start(jobs[0], exportedIn: ["dep/api": 0])
        for job in jobs.dropFirst() {
            try start(job)
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
        #expect(depCrashed.map(\.line) == ["disconnect 2 b#1@0 -> dep#1@0", "wait b#1@0 for dep by dep/api"])
        #expect(again.isEmpty)
    }

    @Test("a lifecycle that reaches a mod that does not run is told it waits, once for each name, and none is launched")
    func waitIsToldOnce() throws {
        // Given
        let a = Job.fixture("a", reaches: ["dep"], uses: ["x/api": 1])
        owners.provide([.fixture("o", provides: ["x/api": [1]]), a], keeping: [])
        try start(a)

        // When
        let first = sut.changes()
        let second = sut.changes()
        _ = try sut.begin(mod: "a", run: 1, lifecycle: 1)
        let above = sut.changes()
        try start(.fixture("dep"), exportedIn: ["dep": 0])
        let connected = sut.changes()

        // Then
        #expect(first.map(\.line) == ["wait a#1@0 for dep by dep", "wait a#1@0 for o by x/api"])
        #expect(second.isEmpty)
        #expect(above.map(\.line) == ["wait a#1@1 for dep by dep", "wait a#1@1 for o by x/api"])
        #expect(connected.map(\.line) == ["connect 1 a#1@0 -> dep#1@0", "connect 2 a#1@1 -> dep#1@0"])
        #expect(runner.run(of: "o") == nil)
    }

    @Test("a connection its dependency's page refused is not made again while both its ends are up")
    func refusedConnectionStaysDown() throws {
        // Given
        let dep = Job.fixture("dep", provides: ["dep/api": [1]])
        let a = Job.fixture("a", uses: ["dep/api": 1])
        owners.provide([dep, a], keeping: [])
        try start(a)
        try start(dep, exportedIn: ["dep/api": 0])
        let connected = sut.changes()

        // When
        sut.refuse(1)
        let refused = sut.changes()
        _ = try runner.unload(["dep"])
        _ = try runner.stopped("dep", run: 1)
        _ = sut.changes()
        try start(dep, exportedIn: ["dep/api": 0], run: 2)
        let relaunched = sut.changes()

        // Then
        #expect(connected.map(\.line) == ["connect 1 a#1@0 -> dep#1@0"])
        #expect(refused.isEmpty)
        #expect(relaunched.map(\.line) == ["connect 2 a#1@0 -> dep#2@0"])
    }

    @Test("a run that waits for exports in a lifecycle they do not reach is told so")
    func unreachedWaitIsAProblem() throws {
        // Given
        let dep = Job.fixture("dep", provides: ["dep/api": [1]])
        let a = Job.fixture("a", uses: ["dep/api": 1])
        owners.provide([dep, a], keeping: [])
        try start(dep, exportedIn: ["dep/api": 1])
        _ = try runner.load([a])
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
        let providers = ["b", "c", "d"].map { id in Job.fixture(id, provides: ["x/api": [1]]) }
        let a = Job.fixture("a", uses: ["x/api": 1])
        owners.provide(providers + [a], keeping: [])
        for job in providers {
            try start(job, exportedIn: ["x/api": 0])
        }
        _ = try runner.load([a])
        let connected = try sut.begin(mod: "a", run: 1, lifecycle: 0)
        _ = try runner.started("a", run: 1)

        // When
        try owners.pin("x/api", to: "c")
        let pinned = sut.changes()
        try owners.pin("x/api", to: nil)
        let cleared = sut.changes()
        owners.provide(Array(providers.dropFirst()) + [a], keeping: [])
        let removed = sut.changes()
        let again = sut.changes()

        // Then
        #expect(connected.map(\.line) == ["1 a#1@0 -> b#1@0"])
        #expect(pinned.map(\.line) == ["disconnect 1 a#1@0 -> b#1@0", "connect 2 a#1@0 -> c#1@0"])
        #expect(cleared.map(\.line) == ["disconnect 2 a#1@0 -> c#1@0", "connect 3 a#1@0 -> b#1@0"])
        #expect(removed.map(\.line) == ["disconnect 3 a#1@0 -> b#1@0", "connect 4 a#1@0 -> c#1@0"])
        #expect(again.isEmpty)
    }

    @Test("an owner that does not provide the major a mod uses is as none to it, and another owner that does connects")
    func ownerOfAnotherMajorDoesNotConnect() throws {
        // Given
        let b = Job.fixture("b", provides: ["x/api": [2]])
        let c = Job.fixture("c", provides: ["x/api": [1, 2]])
        let a = Job.fixture("a", uses: ["x/api": 1])
        owners.provide([b, c, a], keeping: [])
        try start(b, exportedIn: ["x/api": 0])
        try start(c, exportedIn: ["x/api": 0])

        // When
        try start(a)
        let unspoken = sut.changes()
        try owners.pin("x/api", to: "c")
        let spoken = sut.changes()

        // Then
        #expect(unspoken.isEmpty)
        #expect(spoken.map(\.line) == ["connect 1 a#1@0 -> c#1@0"])
    }

    // MARK: - Private
    // The job loads, begins its first lifecycle and starts, the exports for each name in `exportedIn` opened in the
    // lifecycle given.
    private func start(_ job: Job, exportedIn: [String: Int] = [:], run: Int = 1) throws {
        _ = try runner.load([job])
        _ = try sut.begin(mod: job.modId, run: run, lifecycle: 0)
        _ = try runner.started(job.modId, run: run, exportedIn: exportedIn)
    }
}
