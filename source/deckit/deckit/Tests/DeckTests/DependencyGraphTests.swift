//
//  DependencyGraphTests.swift
//  DeckTests
//
//  Created by JSilver on 11/4/26.
//

import Foundation
import Testing
@testable import Deck

// The mods joined by the ids in their [dependencies], as the catalog reads them.
@Suite("DependencyGraph")
struct DependencyGraphTests {
    // MARK: - Property
    private let fixture = RunnerFixture("dependency-graph-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("a mod that requires one not installed does not load, nor one that requires a mod that did not load")
    func requiredMissingFails() throws {
        // Given
        try fixture.write("a", requires: ["none": "1.0.0"])
        try fixture.write("b", requires: ["a": "1.0.0"])
        try fixture.write("c")

        // When
        let sut = try fixture.catalog().mods()

        // Then
        #expect(problems(of: sut) == [
            "a": "needs none, which is not installed",
            "b": "needs a, which did not load",
            "c": nil
        ])
        #expect(relation("a", of: "b", in: sut)?.problem == "needs a, which did not load")
    }

    @Test("a mod at a version a required dependency does not take fails it, and does not list it as a dependent")
    func requiredVersionMismatchFails() throws {
        // Given
        try fixture.write("b")
        try fixture.write("d", requires: ["b": "2.0.0"])

        // When
        let sut = try fixture.catalog().mods()

        // Then
        #expect(problems(of: sut)["d"] == "needs b 2.0.0, and b is 1.0.0")
        #expect(sut.first { mod in mod.manifest.id == "b" }?.dependents == [])
    }

    @Test("a mod at a version an optional dependency does not take is as if there were none, which the relation says")
    func optionalVersionMismatchIsAbsent() throws {
        // Given
        try fixture.write("b")
        try fixture.write("d", optional: ["b": "2.0.0"])

        // When
        let sut = try fixture.catalog().mods()

        // Then
        #expect(problems(of: sut) == ["b": nil, "d": nil])
        #expect(
            relation("b", of: "d", in: sut)
                == Relation(
                    id: "b",
                    optional: true,
                    version: "2.0.0",
                    name: "b",
                    problem: "uses b 2.0.0, and b is 1.0.0, so it runs without it"
                )
        )
        #expect(sut.first { mod in mod.manifest.id == "b" }?.dependents == [])
    }

    @Test("an optional dependency back on a mod that requires it makes no cycle, and neither is its dependent")
    func optionalMakesNoCycle() throws {
        // Given
        try fixture.write("a", requires: ["b": "1.0.0"])
        try fixture.write("b", optional: ["a": "1.0.0"])

        // When
        let sut = try fixture.catalog().mods()

        // Then
        #expect(problems(of: sut) == ["a": nil, "b": nil])
        #expect(sut.map(\.manifest.id) == ["b", "a"])
        #expect(sut.map(\.dependents) == [["a"], []])
    }

    @Test("mods that require one another make a cycle, which fails what requires them, until one stops requiring")
    func cycleFails() throws {
        // Given
        try fixture.write("a", requires: ["b": "1.0.0"])
        try fixture.write("b", requires: ["a": "1.0.0"])
        try fixture.write("c", requires: ["a": "1.0.0"])
        let catalog = try fixture.catalog()

        // When
        let looped = catalog.mods()
        try fixture.write("b")
        let undone = catalog.mods()

        // Then
        #expect(problems(of: looped) == [
            "a": "requires itself: a → b → a",
            "b": "requires itself: a → b → a",
            "c": "needs a, which did not load"
        ])
        #expect(problems(of: undone) == ["a": nil, "b": nil, "c": nil])
    }

    @Test("a mod loads after what it requires, which lists it among its dependents")
    func requirementsComeFirst() throws {
        // Given
        try fixture.write("b")
        try fixture.write("d", requires: ["z": "1.0.0"])
        try fixture.write("z")

        // When
        let sut = try fixture.catalog().mods()

        // Then
        #expect(sut.map(\.manifest.id) == ["b", "z", "d"])
        #expect(sut.map(\.dependents) == [[], ["d"], []])
    }

    // MARK: - Private
    private func problems(of mods: [Mod]) -> [String: String?] {
        Dictionary(uniqueKeysWithValues: mods.map { mod in (mod.manifest.id, mod.problem) })
    }

    private func relation(_ id: String, of dependent: String, in mods: [Mod]) -> Relation? {
        mods.first { mod in mod.manifest.id == dependent }?.relations.first { relation in relation.id == id }
    }
}
