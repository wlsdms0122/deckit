//
//  ExtensionRegistryTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("ExtensionRegistry")
struct ExtensionRegistryTests {
    // MARK: - Property
    private let fixture = RunnerFixture("extension-registry-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("what a run extends that it cannot is a problem, and a point its mod does not open never is")
    func extendingWhatCannotBeIsAProblem() throws {
        // Given
        try fixture.write("calendar")
        try fixture.write("google", requires: ["calendar": "1.0.0"], extends: ["calendar": "1.0.0", "outlook": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ExtensionRegistry(runner: runner)
        _ = try runner.load(["calendar"])
        _ = try runner.started("calendar", run: 1, extensionPoints: ["accounts"])
        _ = try runner.load(["google"])
        _ = try runner.started(
            "google",
            run: 1,
            extensions: [
                "calendar:accounts": [["events"]],
                "calendar:missing": [],
                "lone:point": [],
                "nope": [],
                "outlook:accounts": []
            ]
        )

        // When
        let problems = sut.problems(of: try #require(runner.run(of: "google")), mod: try #require(runner.mod(of: "google")))

        // Then
        #expect(
            problems == [
                "it extends lone's point, and lone is not in [extends]",
                "nope is not <mod id>:<point>"
            ]
        )
    }

    @Test("a point's mod is told what extends it as a mod that extends it starts and once that one has ended")
    func pointsModIsToldWhatExtendsIt() throws {
        // Given
        try fixture.write("calendar")
        try fixture.write("google", extends: ["calendar": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ExtensionRegistry(runner: runner)
        _ = try runner.load(["calendar"])
        _ = sut.changes()

        // When
        _ = try runner.started("calendar", run: 1, extensionPoints: ["accounts"])
        let opened = sut.changes()
        _ = try runner.load(["google"])
        _ = try runner.started("google", run: 1, extensions: ["calendar:accounts": [["events"]]])
        let extended = sut.changes()
        _ = try runner.unload(["google"])
        let terminating = sut.changes()
        _ = try runner.stopped("google", run: 1)
        let ended = sut.changes()
        _ = try runner.load(["google"])
        _ = try runner.started("google", run: 2, extensions: ["calendar:accounts": [["events"]]])
        let again = sut.changes()

        // Then
        #expect(opened.isEmpty)
        #expect(
            extended.map(\.line) == [
                "extensionsChanged calendar 1 accounts google",
                "extendsChanged google calendar:accounts"
            ]
        )
        #expect(terminating.isEmpty)
        #expect(ended.map(\.line) == ["extensionsChanged calendar 1 accounts ", "extendsChanged google "])
        #expect(
            again.map(\.line) == [
                "extensionsChanged calendar 1 accounts google",
                "extendsChanged google calendar:accounts"
            ]
        )
    }

    @Test("a mod that is ending takes no point opened since, and keeps one it extends until it has ended")
    func endingModTakesNoNewPoint() throws {
        // Given
        try fixture.write("calendar")
        try fixture.write("google", requires: ["calendar": "1.0.0"], extends: ["calendar": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ExtensionRegistry(runner: runner)
        _ = try runner.load(["calendar"])
        _ = try runner.started("calendar", run: 1, extensionPoints: ["accounts"])
        _ = try runner.load(["google"])
        _ = try runner.started("google", run: 1, extensions: ["calendar:accounts": [["events"]]])
        _ = sut.changes()

        // When
        _ = try runner.crashed("calendar", run: 1, problem: "its page went away")
        _ = try runner.load(["calendar"])
        let reloaded = sut.changes()
        _ = try runner.started("calendar", run: 2, extensionPoints: ["accounts"])
        let opened = sut.changes()
        let called = Result {
            try sut.call(from: "calendar", run: 2, mod: "google", point: "calendar:accounts", path: ["events"])
        }

        // Then
        #expect(reloaded.map(\.line) == ["extendsChanged google "])
        #expect(opened.isEmpty)
        #expect(throws: ExtensionError.notExtending(mod: "google", point: "calendar:accounts")) { try called.get() }
    }

    @Test("a point is extended only by a mod that names its mod in [extends] at its version")
    func pointIsExtendedAtItsVersion() throws {
        // Given
        try fixture.write("calendar")
        try fixture.write("a", extends: ["calendar": "1.0.0"])
        try fixture.write("b", extends: ["calendar": "2.0.0"])
        let runner = try fixture.runner()
        let sut = ExtensionRegistry(runner: runner)
        _ = try runner.load(["calendar", "a", "b"])
        _ = try runner.started("a", run: 1, extensions: ["calendar:accounts": []])
        _ = try runner.started("b", run: 1, extensions: ["calendar:accounts": []])
        _ = sut.changes()

        // When
        _ = try runner.started("calendar", run: 1, extensionPoints: ["accounts"])
        let effects = sut.changes()

        // Then
        #expect(
            effects.map(\.line) == ["extensionsChanged calendar 1 accounts a", "extendsChanged a calendar:accounts"]
        )
    }

    @Test("a point's mod calls a function of what extends its point, and nothing else")
    func pointsModCallsWhatExtendsIt() throws {
        // Given
        try fixture.write("calendar")
        try fixture.write("google", extends: ["calendar": "1.0.0"])
        try fixture.write("notes", extends: ["calendar": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ExtensionRegistry(runner: runner)
        _ = try runner.load(["calendar"])
        _ = try runner.started("calendar", run: 1, extensionPoints: ["accounts"])
        _ = try runner.load(["google", "notes"])
        _ = try runner.started("google", run: 1, extensions: ["calendar:accounts": [["events"]]])
        _ = try runner.started("notes", run: 1)

        // When
        let called = Result {
            try sut.call(from: "calendar", run: 1, mod: "google", point: "calendar:accounts", path: ["events"])
        }
        let missing = Result {
            try sut.call(from: "calendar", run: 1, mod: "google", point: "calendar:accounts", path: ["other"])
        }
        let unextended = Result {
            try sut.call(from: "calendar", run: 1, mod: "notes", point: "calendar:accounts", path: ["events"])
        }
        let fromExtender = Result {
            try sut.call(from: "google", run: 1, mod: "google", point: "calendar:accounts", path: ["events"])
        }
        let otherRun = Result {
            try sut.call(from: "calendar", run: 2, mod: "google", point: "calendar:accounts", path: ["events"])
        }

        // Then
        #expect(throws: Never.self) { try called.get() }
        #expect(throws: ExtensionError.noSuchFunction(mod: "google", point: "calendar:accounts", path: ["other"])) {
            try missing.get()
        }
        #expect(throws: ExtensionError.notExtending(mod: "notes", point: "calendar:accounts")) { try unextended.get() }
        #expect(throws: ExtensionError.notAPoint("calendar:accounts", of: "google")) { try fromExtender.get() }
        #expect(throws: ExtensionError.notRunning("calendar")) { try otherRun.get() }
    }

    // MARK: - Private
}
