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
    @Test("what a run extends that it cannot is a problem, and a point of an optional dependency never is")
    func testThatExtendingWhatCannotBeIsAProblem() throws {
        // Given
        try fixture.write("calendar")
        try fixture.write("google", requires: ["calendar": "1.0.0"], optional: ["outlook": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ExtensionRegistry(runner: runner)
        _ = try runner.started("calendar", run: 1, extensionPoints: ["accounts"])
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
                "deck.extend() names calendar:missing, which calendar does not open",
                "deck.extend() names lone:point, but lone is in neither [requires] nor [optional]",
                "deck.extend() names nope, which is not <mod id>:<point>"
            ]
        )
    }

    @Test("a point's mod is told what extends it as a mod that extends it starts and once that one has ended")
    func testThatAPointsModIsToldWhatExtendsIt() throws {
        // Given
        try fixture.write("calendar")
        try fixture.write("google", requires: ["calendar": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ExtensionRegistry(runner: runner)
        _ = sut.changes()

        // When
        _ = try runner.started("calendar", run: 1, extensionPoints: ["accounts"])
        let opened = sut.changes()
        _ = try runner.started("google", run: 1, extensions: ["calendar:accounts": [["events"]]])
        let extended = sut.changes()
        _ = try runner.relaunch("google")
        let terminating = sut.changes()
        _ = try runner.stopped("google", run: 1)
        let ended = sut.changes()
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
    func testThatAnEndingModTakesNoNewPoint() throws {
        // Given
        try fixture.write("calendar")
        try fixture.write("google", requires: ["calendar": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ExtensionRegistry(runner: runner)
        _ = try runner.started("calendar", run: 1, extensionPoints: ["accounts"])
        _ = try runner.started("google", run: 1, extensions: ["calendar:accounts": [["events"]]])
        _ = sut.changes()

        // When
        _ = try runner.loaded("calendar")
        let reloaded = sut.changes()
        _ = try runner.started("calendar", run: 2, extensionPoints: ["accounts"])
        let opened = sut.changes()

        // Then
        #expect(reloaded.map(\.line) == ["extendsChanged google "])
        #expect(opened.isEmpty)
        #expect(throws: ExtensionError.notExtending(mod: "google", point: "calendar:accounts")) {
            try sut.call(from: "calendar", run: 2, mod: "google", point: "calendar:accounts", path: ["events"])
        }
    }

    @Test("an optional dependency's point is extended only at a version the mod names")
    func testThatAnOptionalDependencysPointIsExtendedAtItsVersion() throws {
        // Given
        try fixture.write("calendar")
        try fixture.write("a", optional: ["calendar": "1.0.0"])
        try fixture.write("b", optional: ["calendar": "2.0.0"])
        let runner = try fixture.runner()
        let sut = ExtensionRegistry(runner: runner)
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
    func testThatAPointsModCallsWhatExtendsIt() throws {
        // Given
        try fixture.write("calendar")
        try fixture.write("google", requires: ["calendar": "1.0.0"])
        try fixture.write("notes", requires: ["calendar": "1.0.0"])
        let runner = try fixture.runner()
        let sut = ExtensionRegistry(runner: runner)
        _ = try runner.started("calendar", run: 1, extensionPoints: ["accounts"])
        _ = try runner.started("google", run: 1, extensions: ["calendar:accounts": [["events"]]])
        _ = try runner.started("notes", run: 1)

        // When
        let called = Result {
            try sut.call(from: "calendar", run: 1, mod: "google", point: "calendar:accounts", path: ["events"])
        }

        // Then
        #expect(throws: Never.self) {
            try called.get()
        }
        #expect(throws: ExtensionError.noSuchFunction(mod: "google", point: "calendar:accounts", path: ["other"])) {
            try sut.call(from: "calendar", run: 1, mod: "google", point: "calendar:accounts", path: ["other"])
        }
        #expect(throws: ExtensionError.notExtending(mod: "notes", point: "calendar:accounts")) {
            try sut.call(from: "calendar", run: 1, mod: "notes", point: "calendar:accounts", path: ["events"])
        }
        #expect(throws: ExtensionError.notAPoint("calendar:accounts", of: "google")) {
            try sut.call(from: "google", run: 1, mod: "google", point: "calendar:accounts", path: ["events"])
        }
        #expect(throws: ExtensionError.notRunning("calendar")) {
            try sut.call(from: "calendar", run: 2, mod: "google", point: "calendar:accounts", path: ["events"])
        }
    }

    // MARK: - Private
}
