//
//  EventBusTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("EventBus")
struct EventBusTests {
    // MARK: - Property
    private let runner = Runner()
    private let owners = OwnerTable.fixture("event-bus-tests")
    private let sut: EventBus

    // MARK: - Initializer
    init() {
        sut = EventBus(runner: runner, owners: owners)
    }

    // MARK: - Test
    @Test("an event goes, named after its mod, to the runs that listen to it, and only from a run that is running")
    func eventGoesToItsListeners() throws {
        // Given
        _ = try runner.load([
            .fixture("a"),
            .fixture("b", reaches: .only(["a"])),
            .fixture("c", reaches: .only(["a"]))
        ])
        sut.listen(mod: "b", run: 1, names: ["a:status"])
        sut.listen(mod: "c", run: 1, names: ["a:other"])

        // When
        let launching = try sut.emit(mod: "a", run: 1, name: "status")
        _ = try runner.started("a", run: 1)
        let running = try sut.emit(mod: "a", run: 1, name: "status")
        let older = try sut.emit(mod: "a", run: 0, name: "status")

        // Then
        #expect(launching == EventDelivery(name: "a:status", listeners: []))
        #expect(running == EventDelivery(name: "a:status", listeners: ["b"]))
        #expect(older.listeners.isEmpty)
    }

    @Test("a run that has ended hears nothing, and what an older run listens to is not taken")
    func endedRunHearsNothing() throws {
        // Given
        let b = Job.fixture("b", reaches: .only(["a"]))
        _ = try runner.load([.fixture("a"), b])
        _ = try runner.started("a", run: 1)
        _ = try runner.started("b", run: 1)
        sut.listen(mod: "b", run: 1, names: ["a:status"])

        // When
        _ = try runner.unload(["b"])
        _ = try runner.stopped("b", run: 1)
        _ = try runner.load([b])
        sut.dropEnded()
        let relaunched = try sut.emit(mod: "a", run: 1, name: "status")
        sut.listen(mod: "b", run: 1, names: ["a:status"])
        let older = try sut.emit(mod: "a", run: 1, name: "status")
        sut.listen(mod: "b", run: 2, names: ["a:status"])
        let listening = try sut.emit(mod: "a", run: 1, name: "status")

        // Then
        #expect(relaunched.listeners.isEmpty)
        #expect(older.listeners.isEmpty)
        #expect(listening.listeners == ["b"])
    }

    @Test("a run hears only names of its own id, the ids it reaches and the interfaces it uses or provides")
    func runHearsWhatItsJobNames() throws {
        // Given
        _ = try runner.load([
            .fixture("a", provides: ["a/api": [1]]),
            .fixture("b", uses: ["a/api": 1]),
            .fixture("c")
        ])
        _ = try runner.started("a", run: 1)
        _ = try runner.started("c", run: 1)

        // When
        sut.listen(mod: "a", run: 1, names: ["a:status", "a/api:owner-changed", "c:status"])
        sut.listen(mod: "b", run: 1, names: ["a:status", "a/api:owner-changed"])
        sut.listen(mod: "c", run: 1, names: ["a:status", "c:status"])
        let status = try sut.emit(mod: "a", run: 1, name: "status")
        let owner = sut.announce(.owner, of: "a/api")
        let own = try sut.emit(mod: "c", run: 1, name: "status")

        // Then
        #expect(status.listeners == ["a"])
        #expect(owner.listeners == ["a", "b"])
        #expect(own.listeners == ["c"])
    }

    @Test("a run that reaches every mod hears every mod's events, and of interfaces only those it uses or provides")
    func everyModReachHearsEveryModsEvents() throws {
        // Given
        let jobs = [
            Job.fixture("a", provides: ["a/api": [1]]),
            .fixture("c"),
            .fixture("e", reaches: .every, uses: ["c/api": 1])
        ]
        owners.provide(jobs, keeping: [])
        _ = try runner.load(jobs)
        for job in jobs {
            _ = try runner.started(job.modId, run: 1)
        }
        sut.listen(mod: "e", run: 1, names: ["a:status", "c:status", "a/api:posted", "a/api:owner-changed"])

        // When
        let status = try sut.emit(mod: "a", run: 1, name: "status")
        let other = try sut.emit(mod: "c", run: 1, name: "status")
        let signal = try sut.emit(mod: "a", run: 1, name: "a/api:posted")
        let owner = sut.announce(.owner, of: "a/api")

        // Then
        #expect(status.listeners == ["e"])
        #expect(other.listeners == ["e"])
        #expect(signal == EventDelivery(name: "a/api:posted", listeners: []))
        #expect(owner.listeners.isEmpty)
    }

    @Test("the owner of an interface sends a signal named after the interface, and another mod only its own event")
    func ownerSendsInterfaceSignals() throws {
        // Given
        let jobs = [Job.fixture("a", provides: ["a/api": [1]]), .fixture("b", uses: ["a/api": 1])]
        owners.provide(jobs, keeping: [])
        _ = try runner.load(jobs)
        _ = try runner.started("a", run: 1)
        _ = try runner.started("b", run: 1)
        sut.listen(mod: "a", run: 1, names: ["a/api:posted"])
        sut.listen(mod: "b", run: 1, names: ["a/api:posted"])

        // When
        let owner = try sut.emit(mod: "a", run: 1, name: "a/api:posted")
        let other = try sut.emit(mod: "b", run: 1, name: "a/api:posted")

        // Then
        #expect(owner == EventDelivery(name: "a/api:posted", listeners: ["a", "b"]))
        #expect(other == EventDelivery(name: "b:a/api:posted", listeners: []))
    }

    @Test("the owner of an interface sends no signal named as deck tells of the interface, and another mod may")
    func ownerSendsNoReservedSignal() throws {
        // Given
        let jobs = [Job.fixture("a", provides: ["a/api": [1]]), .fixture("b", uses: ["a/api": 1])]
        owners.provide(jobs, keeping: [])
        _ = try runner.load(jobs)
        _ = try runner.started("a", run: 1)
        _ = try runner.started("b", run: 1)
        sut.listen(mod: "b", run: 1, names: ["a/api:owner-changed"])

        // When
        let owner = Result { try sut.emit(mod: "a", run: 1, name: "a/api:owner-changed") }
        let other = try sut.emit(mod: "b", run: 1, name: "a/api:owner-changed")
        let announced = sut.announce(.owner, of: "a/api")

        // Then
        #expect(throws: EventError.reserved("a/api:owner-changed")) { try owner.get() }
        #expect(other == EventDelivery(name: "b:a/api:owner-changed", listeners: []))
        #expect(announced == EventDelivery(name: "a/api:owner-changed", listeners: ["b"]))
    }

    // MARK: - Private
}
