//
//  ExportBrokerTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("ExportBroker")
struct ExportBrokerTests {
    // MARK: - Property
    private let mods = ModSource("export-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("what a run requires is pending while that one launches, and given once it has started")
    func testThatDependenciesWaitForWhatIsRequired() throws {
        // Given
        try mods.write("a")
        try mods.write("b", requires: ["a": "1.0.0"], optional: ["c": "1.0.0"])
        try mods.write("c", version: "2.0.0")
        let runner = try mods.runner()
        let sut = ExportBroker(runner: runner)
        _ = try runner.started("c", run: 1)

        // When
        let pending = try sut.dependencies(mod: "b", run: 1)
        _ = try runner.started("a", run: 1, exports: [["ask"]])
        let ready = try sut.dependencies(mod: "b", run: 1)

        // Then
        #expect(pending.pending == Pending(mod: "a", run: 1, state: .launching))
        #expect(ready.ready?.requires["a"]?.functions == [["ask"]])
        #expect(ready.ready?.requires["a"]?.values == #"{"id":"a"}"#)
        #expect(ready.ready?.optional.keys.sorted() == ["c"])
        #expect(ready.ready?.optional["c"] == .some(nil))
    }

    @Test("a run is refused what it requires once that one has ended for good")
    func testThatDependenciesAreRefusedOnceARequirementEnded() throws {
        // Given
        try mods.write("a")
        try mods.write("b", requires: ["a": "1.0.0"])
        let runner = try mods.runner()
        let sut = ExportBroker(runner: runner)

        // When
        _ = try runner.crash("a", run: 1, problem: "its page ended")

        // Then
        #expect(throws: ExportError.needs("a", problem: "its page ended")) {
            try sut.dependencies(mod: "b", run: 1)
        }
        #expect(throws: ExportError.notRunning("b")) {
            try sut.dependencies(mod: "b", run: 2)
        }
    }

    @Test("a call goes to a function of what the caller requires, and to nothing else")
    func testThatACallReachesOnlyWhatIsRequired() throws {
        // Given
        try mods.write("a")
        try mods.write("b", requires: ["a": "1.0.0"])
        let runner = try mods.runner()
        let sut = ExportBroker(runner: runner)
        _ = try runner.started("a", run: 1, exports: [["ask"]])
        _ = try runner.started("b", run: 1)

        // When
        let called = try sut.call(from: "b", run: 1, mod: "a", path: ["ask"])

        // Then
        #expect(called.ready == true)
        #expect(throws: ExportError.noSuchFunction(mod: "a", path: ["tell"])) {
            try sut.call(from: "b", run: 1, mod: "a", path: ["tell"])
        }
        #expect(throws: ExportError.notADependency(mod: "b", of: "a")) {
            try sut.call(from: "a", run: 1, mod: "b", path: ["ask"])
        }
        #expect(throws: ExportError.notRunning("b")) {
            try sut.call(from: "b", run: 2, mod: "a", path: ["ask"])
        }
    }

    @Test("a call reaches a run that terminates, waits for one launching again, and an ending caller does not wait")
    func testThatACallFollowsTheRunsOfWhatItCalls() throws {
        // Given
        try mods.write("a")
        try mods.write("b", requires: ["a": "1.0.0"])
        let runner = try mods.runner()
        let sut = ExportBroker(runner: runner)
        _ = try runner.started("a", run: 1, exports: [["ask"]])
        _ = try runner.started("b", run: 1)

        // When
        _ = try runner.relaunch("a")
        let terminating = try sut.call(from: "b", run: 1, mod: "a", path: ["ask"])
        _ = try runner.stopped("b", run: 1)
        _ = try runner.stopped("a", run: 1)
        let launching = try sut.call(from: "b", run: 2, mod: "a", path: ["ask"])
        _ = try runner.started("a", run: 2, exports: [["ask"]])
        _ = try runner.started("b", run: 2)
        _ = try runner.crash("a", run: 2, problem: "its page ended")

        // Then
        #expect(terminating.ready == true)
        #expect(launching.pending == Pending(mod: "a", run: 2, state: .launching))
        #expect(throws: ExportError.notRunning("a")) {
            try sut.call(from: "b", run: 2, mod: "a", path: ["ask"])
        }
    }

    @Test("an optional dependency is reached only while it runs at a version the mod names")
    func testThatAnOptionalDependencyIsReachedAtItsVersion() throws {
        // Given
        try mods.write("a", version: "2.0.0")
        try mods.write("b", optional: ["a": "1.0.0"])
        try mods.write("c", optional: ["a": "2.0.0"])
        let runner = try mods.runner()
        let sut = ExportBroker(runner: runner)
        _ = try runner.started("b", run: 1)
        _ = try runner.started("c", run: 1)

        // When
        let launching = Result { try sut.call(from: "c", run: 1, mod: "a", path: ["ask"]) }
        _ = try runner.started("a", run: 1, exports: [["ask"]])
        let running = try sut.call(from: "c", run: 1, mod: "a", path: ["ask"])

        // Then
        #expect(throws: ExportError.notRunning("a")) {
            try launching.get()
        }
        #expect(running.ready == true)
        #expect(throws: ExportError.otherVersion(mod: "a", version: "2.0.0", dependent: "b", wanted: "1.0.0")) {
            try sut.call(from: "b", run: 1, mod: "a", path: ["ask"])
        }
    }

    @Test("a run is told what an optional dependency exports as that one starts and as it begins to end, a new run not")
    func testThatOptionalDependentsAreToldOfChanges() throws {
        // Given
        try mods.write("a")
        try mods.write("b", optional: ["a": "1.0.0"])
        let runner = try mods.runner()
        let sut = ExportBroker(runner: runner)
        _ = try runner.started("b", run: 1)
        _ = sut.changes()

        // When
        _ = try runner.started("a", run: 1, exports: [["ask"]])
        let started = sut.changes()
        _ = try runner.relaunch("a")
        let terminating = sut.changes()
        _ = try runner.relaunch("b")
        _ = try runner.stopped("b", run: 1)
        let relaunched = sut.changes()

        // Then
        #expect(started.map(\.line) == ["optionalChanged b a exports"])
        #expect(terminating.map(\.line) == ["optionalChanged b a none"])
        #expect(relaunched.isEmpty)
    }

    // MARK: - Private
}
