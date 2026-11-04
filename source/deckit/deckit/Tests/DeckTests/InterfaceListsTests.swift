//
//  InterfaceListsTests.swift
//  DeckTests
//
//  Created by JSilver on 11/4/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("InterfaceLists")
struct InterfaceListsTests {
    // MARK: - Property
    private let fixture = RunnerFixture("interface-lists-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("a list comes in the person's order, then the host app's, then by id, with each that loads by its manifest")
    func listComesInOrder() throws {
        // Given
        for id in ["p", "r", "s", "t"] {
            try fixture.write(id, implements: ["x/list": "1.0.0"])
        }
        try fixture.write("q", implements: ["x/list": "1.0.0"], requires: ["y/none": "1.0.0"])
        try fixture.writeSettings(#"{"implementations":{"x/list":{"order":["t","gone"],"off":[]}}}"#)

        // When
        let sut = try fixture.catalog(implementations: ["x/list": ["s", "gone", "r", "t"]])

        // Then
        let list = try #require(sut.interfaces.first { list in list.interface == "x/list" })
        #expect(list.implementations.map(\.id) == ["t", "s", "r", "p", "q"])
    }

    @Test("an interface is undecided while two or more no one placed are on, and none placed is on")
    func undecidedCountsOnlyUnplacedOnes() throws {
        // Given
        let all = ["x/two": "1.0.0", "x/placed": "1.0.0", "x/off": "1.0.0", "x/placed-off": "1.0.0"]
        try fixture.write("a", implements: all)
        try fixture.write("b", implements: all)
        try fixture.write("c", implements: ["x/placed": "1.0.0", "x/placed-off": "1.0.0"])
        try fixture.writeSettings(
            #"{"implementations":{"x/off":{"order":[],"off":["b"]},"x/placed-off":{"order":[],"off":["a"]}}}"#
        )

        // When
        let sut = try fixture.catalog(implementations: ["x/placed": ["a"], "x/placed-off": ["a"]])

        // Then
        let undecided = Dictionary(
            uniqueKeysWithValues: sut.interfaces.map { list in (list.interface, list.undecided) }
        )
        #expect(undecided == ["x/two": true, "x/placed": false, "x/off": false, "x/placed-off": true])
    }

    @Test("the pick is the first on, whatever version it implements and whether it runs")
    func pickIsFirstOn() throws {
        // Given
        try fixture.write("a", implements: ["x/api": "1.0.0"])
        try fixture.write("b", implements: ["x/api": "2.0.0"])
        try fixture.write("c", implements: ["x/api": "1.0.0"])
        try fixture.write("d", requires: ["x/api": "1.0.0"])
        try fixture.writeSettings(#"{"implementations":{"x/api":{"order":[],"off":["a"]}}}"#)
        let catalog = try fixture.catalog()
        let sut = Runner(catalog: catalog)
        _ = try sut.load(["b"])

        // When
        _ = try sut.crashed("b", run: 1, problem: "its page ended (crashed)")

        // Then
        let list = try #require(catalog.interfaces.first { list in list.interface == "x/api" })
        #expect(list.implementations.map(\.on) == [false, true, true])
        #expect(list.pick?.id == "b")
        #expect(sut.pick(of: "x/api") == "b")
        #expect(sut.pick(of: "y/none") == nil)
    }

    @Test("a list is named by the mod whose id it starts with, and has none while that mod is not found")
    func listIsNamedByItsDefiner() throws {
        // Given
        try fixture.write("x", implements: ["x/api": "1.0.0"])
        try fixture.write("a", optional: ["y/api": "1.0.0"])

        // When
        let sut = try fixture.catalog()

        // Then
        #expect(sut.interfaces.map(\.interface) == ["x/api", "y/api"])
        #expect(sut.interfaces.map(\.name) == ["x", nil])
        #expect(sut.interfaces.last?.implementations == [])
        #expect(sut.interfaces.last?.pick == nil)
    }

    // MARK: - Private
}
