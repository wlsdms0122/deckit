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
    @Test("a lifecycle that begins connects to the exports of the interfaces it uses, and a message goes across")
    func beginningLifecycleConnects() throws {
        // Given
        let dep = Job.fixture("dep", provides: ["dep/api": [1]])
        let a = Job.fixture("a", uses: ["dep/api": 1])
        owners.provide([dep, a], keeping: [])
        try start(dep, exportedIn: ["dep/api": 0])
        _ = try runner.load([a])

        // When
        let first = try sut.begin(principal: "a", run: 1, lifecycle: 0)
        _ = try runner.started("a", run: 1)
        let second = try sut.begin(principal: "a", run: 1, lifecycle: 1)
        let reached = try sut.route(from: "a", run: 1, connection: 1)
        let back = try sut.route(from: "dep", run: 1, connection: 1)
        let stranger = Result { try sut.route(from: "b", run: 1, connection: 1) }
        let none = Result { try sut.route(from: "a", run: 1, connection: 9) }

        // Then
        #expect(first.map(\.line) == ["1 a#1@0 -> dep#1@0"])
        #expect(second.map(\.line) == ["2 a#1@1 -> dep#1@0"])
        #expect(reached == Endpoint(principal: "dep", run: 1, lifecycle: 0))
        #expect(back == Endpoint(principal: "a", run: 1, lifecycle: 0))
        #expect(throws: ConnectionError.notAnEnd(principal: "b")) { try stranger.get() }
        #expect(throws: ConnectionError.ended) { try none.get() }
        #expect(sut.changes().isEmpty)
    }

    @Test("a connection tells its service the client's principal and the ids of the permissions granted to its job")
    func connectionCarriesTheClientsCredential() throws {
        // Given
        let dep = Job.fixture("dep", permissions: ["dep.secret"], provides: ["dep/api": [1]])
        let a = Job.fixture("a", permissions: ["a.files", "a.network"], uses: ["dep/api": 1])
        owners.provide([dep, a], keeping: [])
        try start(dep, exportedIn: ["dep/api": 0])

        _ = try runner.load([a])

        // When
        let connected = try sut.begin(principal: "a", run: 1, lifecycle: 0)

        // Then
        #expect(connected.map(\.credential) == [Credential(principal: "a", permissions: ["a.files", "a.network"])])
    }

    @Test("exports opened in a lifecycle reach it and those above, and a user of the major the owner provides connects")
    func exportsReachTheirLifecycleAndAbove() throws {
        // Given
        let dep = Job.fixture("dep", provides: ["dep/api": [1, 2]])
        let jobs = [dep, .fixture("a", uses: ["dep/api": 1]), .fixture("old", uses: ["dep/api": 0])]
        owners.provide(jobs, keeping: [])
        for job in jobs.dropFirst() {
            try start(job)
            _ = try sut.begin(principal: job.principal, run: 1, lifecycle: 1)
        }
        _ = try runner.load([dep])
        _ = try sut.begin(principal: "dep", run: 1, lifecycle: 0)
        _ = try sut.begin(principal: "dep", run: 1, lifecycle: 1)

        // When
        _ = try runner.started("dep", run: 1, exportedIn: ["dep/api": 1])
        let started = sut.changes()

        // Then
        #expect(
            started.map(\.line) == [
                "connect 1 a#1@1 -> dep#1@1",
                "refuse a#1@0 by dep/api: dep runs with no exports for dep/api that reach the lifecycle"
            ]
        )
    }

    @Test("one reached by id connects by the exports it opened for its id, not those of an interface it provides")
    func idReachConnectsByTheIdsExports() throws {
        // Given
        let dep = Job.fixture("dep", provides: ["dep/api": [1]])
        let other = Job.fixture("other", provides: ["other/api": [1]])
        owners.provide([dep, other], keeping: [])
        try start(dep, exportedIn: ["dep/api": 0])
        try start(other, exportedIn: ["other": 0])
        try start(.fixture("a", reaches: .only(["dep", "other"])))
        let client = Endpoint(principal: "a", run: 1, lifecycle: 0)

        // When
        try sut.reach("dep", from: client)
        try sut.reach("other", from: client)
        let reached = sut.changes()

        // Then
        #expect(
            reached.map(\.line) == [
                "connect 1 a#1@0 -> other#1@0",
                "refuse a#1@0 by dep: dep runs with no exports for dep that reach the lifecycle"
            ]
        )
    }

    @Test("a principal that owns an interface it uses reaches no one by it")
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

    @Test("a connection ends with either lifecycle, and only once, and one left reaching a principal that ended waits")
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
        sut.end(principal: "a", run: 1, lifecycle: 0)
        let aEnded = sut.changes()
        _ = try runner.crashed("dep", run: 1, problem: "gone")
        let depCrashed = sut.changes()
        let again = sut.changes()

        // Then
        #expect(aEnded.map(\.line) == ["disconnect 1 a#1@0 -> dep#1@0"])
        #expect(depCrashed.map(\.line) == ["disconnect 2 b#1@0 -> dep#1@0", "wait b#1@0 for dep by dep/api"])
        #expect(again.isEmpty)
    }

    @Test("a lifecycle that uses an interface whose owner does not run is told it waits, once, and none is launched")
    func waitIsToldOnce() throws {
        // Given
        let o = Job.fixture("o", provides: ["x/api": [1]])
        let a = Job.fixture("a", uses: ["x/api": 1])
        owners.provide([o, a], keeping: [])
        try start(a)

        // When
        let first = sut.changes()
        let second = sut.changes()
        _ = try sut.begin(principal: "a", run: 1, lifecycle: 1)
        let above = sut.changes()
        let launched = runner.run(of: "o")
        try start(o, exportedIn: ["x/api": 0])
        let connected = sut.changes()

        // Then
        #expect(first.map(\.line) == ["wait a#1@0 for o by x/api"])
        #expect(second.isEmpty)
        #expect(above.map(\.line) == ["wait a#1@1 for o by x/api"])
        #expect(launched == nil)
        #expect(connected.map(\.line) == ["connect 1 a#1@0 -> o#1@0", "connect 2 a#1@1 -> o#1@0"])
    }

    @Test("a lifecycle asking to reach a running principal by id connects to it, and one not asking reaches none")
    func askToARunningModConnects() throws {
        // Given
        try start(.fixture("dep"), exportedIn: ["dep": 0])
        try start(.fixture("a", reaches: .only(["dep"])))
        _ = try sut.begin(principal: "a", run: 1, lifecycle: 1)
        let unasked = sut.changes()

        // When
        try sut.reach("dep", from: Endpoint(principal: "a", run: 1, lifecycle: 1))
        let asked = sut.changes()
        let reached = try sut.route(from: "a", run: 1, connection: 1)

        // Then
        #expect(unasked.isEmpty)
        #expect(asked.map(\.line) == ["connect 1 a#1@1 -> dep#1@0"])
        #expect(reached == Endpoint(principal: "dep", run: 1, lifecycle: 0))
    }

    @Test("an ask to reach a principal not running is told it waits once, none launched, and connects once it runs")
    func askToAModNotRunningWaits() throws {
        // Given
        let client = Endpoint(principal: "a", run: 1, lifecycle: 0)
        try start(.fixture("a", reaches: .only(["dep"])))

        // When
        try sut.reach("dep", from: client)
        let first = sut.changes()
        try sut.reach("dep", from: client)
        let again = sut.changes()
        let launched = runner.run(of: "dep")
        try start(.fixture("dep"), exportedIn: ["dep": 0])
        let connected = sut.changes()

        // Then
        #expect(first.map(\.line) == ["wait a#1@0 for dep by dep"])
        #expect(again.isEmpty)
        #expect(launched == nil)
        #expect(connected.map(\.line) == ["connect 1 a#1@0 -> dep#1@0"])
    }

    @Test("one reaching a principal that terminates is told it waits once its run has ended, not before")
    func reachingATerminatingPrincipalWaitsOnceItEnded() throws {
        // Given
        let client = Endpoint(principal: "a", run: 1, lifecycle: 0)
        try start(.fixture("dep"), exportedIn: ["dep": 0])
        try start(.fixture("a", reaches: .only(["dep"])))
        try sut.reach("dep", from: client)
        _ = sut.changes()

        // When
        _ = try runner.unload(["dep"])
        let terminating = sut.changes()
        _ = try runner.stopped("dep", run: 1)
        let ended = sut.changes()

        // Then
        #expect(terminating.isEmpty)
        #expect(ended.map(\.line) == ["disconnect 1 a#1@0 -> dep#1@0", "wait a#1@0 for dep by dep"])
    }

    @Test("a connection by id ends as its client releases the id or its lifecycle ends, and the ask goes with it")
    func releaseEndsTheConnection() throws {
        // Given
        let lower = Endpoint(principal: "a", run: 1, lifecycle: 0)
        let upper = Endpoint(principal: "a", run: 1, lifecycle: 1)
        try start(.fixture("dep"), exportedIn: ["dep": 0])
        try start(.fixture("a", reaches: .only(["dep"])))
        _ = try sut.begin(principal: "a", run: 1, lifecycle: 1)
        try sut.reach("dep", from: lower)
        try sut.reach("dep", from: upper)
        let connected = sut.changes()

        // When
        sut.release("dep", from: lower)
        let released = sut.changes()
        sut.end(principal: "a", run: 1, lifecycle: 1)
        let ended = sut.changes()
        let begunAgain = try sut.begin(principal: "a", run: 1, lifecycle: 1)

        // Then
        #expect(connected.map(\.line) == ["connect 1 a#1@0 -> dep#1@0", "connect 2 a#1@1 -> dep#1@0"])
        #expect(released.map(\.line) == ["disconnect 1 a#1@0 -> dep#1@0"])
        #expect(ended.map(\.line) == ["disconnect 2 a#1@1 -> dep#1@0"])
        #expect(begunAgain.isEmpty)
    }

    @Test("an ask to reach an id the job may not reach, its own, or from a lifecycle that has ended is refused")
    func askOutsideReachesIsRefused() throws {
        // Given
        try start(.fixture("dep"), exportedIn: ["dep": 0])
        try start(.fixture("a", reaches: .only(["dep"])))
        try start(.fixture("e", reaches: .every))
        _ = try sut.begin(principal: "a", run: 1, lifecycle: 1)
        sut.end(principal: "a", run: 1, lifecycle: 1)

        // When
        let outside = Result { try sut.reach("b", from: Endpoint(principal: "a", run: 1, lifecycle: 0)) }
        let own = Result { try sut.reach("e", from: Endpoint(principal: "e", run: 1, lifecycle: 0)) }
        let ended = Result { try sut.reach("dep", from: Endpoint(principal: "a", run: 1, lifecycle: 1)) }
        let notRunning = Result { try sut.reach("dep", from: Endpoint(principal: "x", run: 1, lifecycle: 0)) }

        // Then
        #expect(throws: ConnectionError.outOfReach(principal: "b", client: "a")) { try outside.get() }
        #expect(throws: ConnectionError.ownId("e")) { try own.get() }
        #expect(throws: ConnectionError.lifecycleEnded(Endpoint(principal: "a", run: 1, lifecycle: 1))) {
            try ended.get()
        }
        #expect(throws: ConnectionError.notRunning("x")) { try notRunning.get() }
        #expect(sut.changes().isEmpty)
    }

    @Test("a job that reaches every principal connects to any principal it asks for by id")
    func everyModReachConnectsToAnyAsked() throws {
        // Given
        let client = Endpoint(principal: "e", run: 1, lifecycle: 0)
        try start(.fixture("b"), exportedIn: ["b": 0])
        try start(.fixture("c"), exportedIn: ["c": 0])
        try start(.fixture("e", reaches: .every))

        // When
        let unasked = sut.changes()
        try sut.reach("b", from: client)
        try sut.reach("c", from: client)
        try sut.reach("d", from: client)
        let asked = sut.changes()

        // Then
        #expect(unasked.isEmpty)
        #expect(
            asked.map(\.line) == [
                "connect 1 e#1@0 -> b#1@0",
                "connect 2 e#1@0 -> c#1@0",
                "wait e#1@0 for d by d"
            ]
        )
    }

    @Test("a connection its service's page refused is not made again while both its ends are up")
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

    @Test("a connection by id its service's page refused is made anew as its client releases the id and asks again")
    func refusedConnectionIsAskedAnew() throws {
        // Given
        let client = Endpoint(principal: "a", run: 1, lifecycle: 0)
        try start(.fixture("dep"), exportedIn: ["dep": 0])
        try start(.fixture("a", reaches: .only(["dep"])))
        try sut.reach("dep", from: client)
        let connected = sut.changes()

        // When
        sut.refuse(1)
        let held = sut.changes()
        sut.release("dep", from: client)
        let released = sut.changes()
        try sut.reach("dep", from: client)
        let askedAgain = sut.changes()

        // Then
        #expect(connected.map(\.line) == ["connect 1 a#1@0 -> dep#1@0"])
        #expect(held.isEmpty)
        #expect(released.isEmpty)
        #expect(askedAgain.map(\.line) == ["connect 2 a#1@0 -> dep#1@0"])
    }

    @Test("a lifecycle reaching a principal running with no exports for the name is refused once an ask, then connects")
    func reachWithoutExportsIsRefused() throws {
        // Given
        let client = Endpoint(principal: "a", run: 1, lifecycle: 0)
        let dep = Job.fixture("dep", provides: ["dep/api": [1]])
        let a = Job.fixture("a", reaches: .only(["dep"]), uses: ["dep/api": 1])
        owners.provide([dep, a], keeping: [])
        try start(a)
        _ = try runner.load([dep])
        _ = try sut.begin(principal: "dep", run: 1, lifecycle: 0)
        try sut.reach("dep", from: client)
        let launching = sut.changes()

        // When
        _ = try runner.started("dep", run: 1)
        let running = sut.changes()
        let again = sut.changes()
        sut.release("dep", from: client)
        let released = sut.changes()
        try sut.reach("dep", from: client)
        let askedAgain = sut.changes()
        _ = try runner.unload(["dep"])
        _ = try runner.stopped("dep", run: 1)
        try start(dep, exportedIn: ["dep": 0, "dep/api": 0], run: 2)
        let opened = sut.changes()

        // Then
        #expect(launching.isEmpty)
        #expect(
            running.map(\.line) == [
                "refuse a#1@0 by dep: dep runs with no exports for dep that reach the lifecycle",
                "refuse a#1@0 by dep/api: dep runs with no exports for dep/api that reach the lifecycle"
            ]
        )
        #expect(again.isEmpty)
        #expect(released.isEmpty)
        #expect(
            askedAgain.map(\.line) == ["refuse a#1@0 by dep: dep runs with no exports for dep that reach the lifecycle"]
        )
        #expect(opened.map(\.line) == ["connect 1 a#1@0 -> dep#2@0", "connect 2 a#1@0 -> dep#2@0"])
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
        let connected = try sut.begin(principal: "a", run: 1, lifecycle: 0)
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

    @Test("an owner not providing the major a principal uses is as none to it, and another owner that does connects")
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
        _ = try sut.begin(principal: job.principal, run: run, lifecycle: 0)
        _ = try runner.started(job.principal, run: run, exportedIn: exportedIn)
    }
}
