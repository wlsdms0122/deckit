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
    private let fixture = RunnerFixture("export-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("a run is given what each mod it requires exports")
    func requiresGiveWhatIsExported() throws {
        // Given
        try fixture.write("a")
        try fixture.write("b", requires: ["a": "1.0.0"], extends: ["c": "1.0.0"])
        try fixture.write("c")
        let runner = try fixture.runner()
        let sut = ExportBroker(runner: runner)
        _ = try runner.load(["a", "c"])
        _ = try runner.started("a", run: 1, exports: [["ask"]])
        _ = try runner.started("c", run: 1, exports: [["tell"]])
        _ = try runner.load(["b"])

        // When
        let requires = try sut.requires(mod: "b", run: 1)

        // Then
        #expect(requires.keys.sorted() == ["a"])
        #expect(requires["a"]?.functions == [["ask"]])
        #expect(requires["a"]?.values == #"{"id":"a"}"#)
    }

    @Test("a run is refused what it requires once that one has ended")
    func dependenciesAreRefusedOnceARequirementEnded() throws {
        // Given
        try fixture.write("a")
        try fixture.write("b", requires: ["a": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ExportBroker(runner: runner)
        _ = try runner.load(["a"])
        _ = try runner.started("a", run: 1)
        _ = try runner.load(["b"])

        // When
        _ = try runner.crashed("a", run: 1, problem: "its page ended")
        let ended = Result { try sut.requires(mod: "b", run: 1) }
        let otherRun = Result { try sut.requires(mod: "b", run: 2) }

        // Then
        #expect(throws: ExportError.notRunning("a")) { try ended.get() }
        #expect(throws: ExportError.notRunning("b")) { try otherRun.get() }
    }

    @Test("a call goes to a function of what the caller requires, and to nothing else, a mod it extends neither")
    func callReachesOnlyWhatIsRequired() throws {
        // Given
        try fixture.write("a")
        try fixture.write("b", requires: ["a": "1.0.0"])
        try fixture.write("c", extends: ["a": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ExportBroker(runner: runner)
        _ = try runner.load(["a"])
        _ = try runner.started("a", run: 1, exports: [["ask"]])
        _ = try runner.load(["b", "c"])
        _ = try runner.started("b", run: 1)
        _ = try runner.started("c", run: 1)

        // When
        let called = Result { try sut.call(from: "b", run: 1, mod: "a", path: ["ask"]) }
        let missing = Result { try sut.call(from: "b", run: 1, mod: "a", path: ["tell"]) }
        let unrequired = Result { try sut.call(from: "a", run: 1, mod: "b", path: ["ask"]) }
        let extended = Result { try sut.call(from: "c", run: 1, mod: "a", path: ["ask"]) }
        let otherRun = Result { try sut.call(from: "b", run: 2, mod: "a", path: ["ask"]) }

        // Then
        #expect(throws: Never.self) { try called.get() }
        #expect(throws: ExportError.noSuchFunction(mod: "a", path: ["tell"])) { try missing.get() }
        #expect(throws: ExportError.notRequired(mod: "b", of: "a")) { try unrequired.get() }
        #expect(throws: ExportError.notRequired(mod: "a", of: "c")) { try extended.get() }
        #expect(throws: ExportError.notRunning("b")) { try otherRun.get() }
    }

    @Test("a call reaches a run that terminates until the caller has ended, and none that crashed")
    func callFollowsTheRunsOfWhatItCalls() throws {
        // Given
        try fixture.write("a")
        try fixture.write("b", requires: ["a": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ExportBroker(runner: runner)
        _ = try runner.load(["a"])
        _ = try runner.started("a", run: 1, exports: [["ask"]])
        _ = try runner.load(["b"])
        _ = try runner.started("b", run: 1)

        // When
        _ = try runner.unload(["a"])
        let terminating = Result { try sut.call(from: "b", run: 1, mod: "a", path: ["ask"]) }
        _ = try runner.stopped("b", run: 1)
        let ended = Result { try sut.call(from: "b", run: 1, mod: "a", path: ["ask"]) }
        _ = try runner.stopped("a", run: 1)
        _ = try runner.load(["a"])
        _ = try runner.started("a", run: 2, exports: [["ask"]])
        _ = try runner.load(["b"])
        _ = try runner.started("b", run: 2)
        _ = try runner.crashed("a", run: 2, problem: "its page ended")
        let crashed = Result { try sut.call(from: "b", run: 2, mod: "a", path: ["ask"]) }

        // Then
        #expect(throws: Never.self) { try terminating.get() }
        #expect(throws: ExportError.notRunning("b")) { try ended.get() }
        #expect(throws: ExportError.notRunning("a")) { try crashed.get() }
    }

    // MARK: - Private
}
