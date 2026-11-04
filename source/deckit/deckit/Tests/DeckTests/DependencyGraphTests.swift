//
//  DependencyGraphTests.swift
//  DeckTests
//
//  Created by JSilver on 11/4/26.
//

import Foundation
import Testing
@testable import Deck

// The mods joined through the implementation picked for each interface, as the catalog reads them.
@Suite("DependencyGraph")
struct DependencyGraphTests {
    // MARK: - Property
    private let fixture = RunnerFixture("dependency-graph-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("a mod that requires an interface with no pick does not load, one with every implementation off too")
    func requiredWithNoPickFails() throws {
        // Given
        try fixture.write("a", implements: ["x/off": "1.0.0"])
        try fixture.write("d", requires: ["x/none": "1.0.0"])
        try fixture.write("e", requires: ["x/off": "1.0.0"])
        try fixture.writeSettings(#"{"implementations":{"x/off":{"order":[],"off":["a"]}}}"#)

        // When
        let sut = try fixture.catalog().mods()

        // Then
        #expect(problems(of: sut) == [
            "a": nil,
            "d": "needs x/none, and no implementation of it is on",
            "e": "needs x/off, and no implementation of it is on"
        ])
        #expect(relation("x/off", of: "e", in: sut)?.id == nil)
    }

    @Test("a pick that does not load fails what requires it, and the next in the list is not taken in its place")
    func pickNotLoadingFails() throws {
        // Given
        try fixture.write("b", implements: ["x/api": "1.0.0"], requires: ["y/none": "1.0.0"])
        try fixture.write("c", implements: ["x/api": "1.0.0"])
        try fixture.write("d", requires: ["x/api": "1.0.0"])

        // When
        let sut = try fixture.catalog().mods()

        // Then
        #expect(problems(of: sut)["d"] == "needs x/api, which b implements and did not load")
        #expect(relation("x/api", of: "d", in: sut)?.id == "b")
    }

    @Test("a pick at a version a required dependency does not take fails it, though another implements that version")
    func requiredVersionMismatchFails() throws {
        // Given
        try fixture.write("b", implements: ["x/api": "1.0.0"])
        try fixture.write("c", implements: ["x/api": "2.0.0"])
        try fixture.write("d", requires: ["x/api": "2.0.0"])

        // When
        let sut = try fixture.catalog().mods()

        // Then
        #expect(problems(of: sut)["d"] == "needs x/api 2.0.0, and b implements it at 1.0.0")
        #expect(sut.first { mod in mod.manifest.id == "b" }?.dependents == [])
    }

    @Test("a pick at a version an optional dependency does not take is as if there were none, which the relation says")
    func optionalVersionMismatchIsAbsent() throws {
        // Given
        try fixture.write("b", implements: ["x/api": "1.0.0"])
        try fixture.write("d", optional: ["x/api": "2.0.0"])

        // When
        let sut = try fixture.catalog().mods()

        // Then
        #expect(problems(of: sut) == ["b": nil, "d": nil])
        #expect(
            relation("x/api", of: "d", in: sut)
                == Relation(
                    interface: "x/api",
                    optional: true,
                    version: "2.0.0",
                    id: "b",
                    name: "b",
                    problem: "uses x/api 2.0.0, and b implements it at 1.0.0, so it runs without it"
                )
        )
        #expect(sut.first { mod in mod.manifest.id == "b" }?.dependents == [])
    }

    @Test("a mod picked for an interface it depends on as optional has none, with no problem and no cycle")
    func optionalSelfPickIsAbsent() throws {
        // Given
        try fixture.write("d", implements: ["x/api": "1.0.0"], optional: ["x/api": "2.0.0"])

        // When
        let sut = try fixture.catalog().mods()

        // Then
        #expect(problems(of: sut) == ["d": nil])
        #expect(
            relation("x/api", of: "d", in: sut)
                == Relation(interface: "x/api", optional: true, version: "2.0.0", id: nil, name: nil, problem: nil)
        )
        #expect(sut.first?.dependents == [])
    }

    @Test("mods that require one another through their picks make a cycle, which another pick undoes")
    func cycleThroughPicksFails() throws {
        // Given
        try fixture.write("a", implements: ["x/one": "1.0.0"], requires: ["x/two": "1.0.0"])
        try fixture.write("b", implements: ["x/two": "1.0.0"], requires: ["x/one": "1.0.0"])
        try fixture.write("c", implements: ["x/two": "1.0.0"])
        let catalog = try fixture.catalog()

        // When
        let looped = catalog.mods()
        try fixture.writeSettings(#"{"implementations":{"x/two":{"order":["c"],"off":[]}}}"#)
        let undone = catalog.mods()

        // Then
        #expect(problems(of: looped) == [
            "a": "requires itself: a → b → a",
            "b": "requires itself: a → b → a",
            "c": nil
        ])
        #expect(problems(of: undone) == ["a": nil, "b": nil, "c": nil])
    }

    @Test("a mod loads after the pick for what it requires, which lists it among its dependents")
    func loadOrderFollowsThePick() throws {
        // Given
        try fixture.write("b", implements: ["x/api": "1.0.0"])
        try fixture.write("d", requires: ["x/api": "1.0.0"])
        try fixture.write("z", implements: ["x/api": "1.0.0"])

        // When
        let sut = try fixture.catalog(implementations: ["x/api": ["z"]]).mods()

        // Then
        #expect(sut.map(\.manifest.id) == ["b", "z", "d"])
        #expect(sut.map(\.dependents) == [[], ["d"], []])
    }

    // MARK: - Private
    private func problems(of mods: [Mod]) -> [String: String?] {
        Dictionary(uniqueKeysWithValues: mods.map { mod in (mod.manifest.id, mod.problem) })
    }

    private func relation(_ interface: String, of id: String, in mods: [Mod]) -> Relation? {
        mods.first { mod in mod.manifest.id == id }?.relations.first { relation in relation.interface == interface }
    }
}
