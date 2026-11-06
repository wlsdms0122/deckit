//
//  DeclarationTests.swift
//  DeckitTests
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("Declaration")
struct DeclarationTests {
    // MARK: - Property
    private let fixture = DeckitFixture("declaration-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("the owner is handed each entry declared to its interface as the mod wrote it")
    func ownerIsHandedEachEntry() throws {
        // Given
        try fixture.write("o", provides: ["o/actions"])
        let open: JSONValue = .object([
            "title": .string("Open"),
            "command": .string("open"),
            "args": .object(["x": .number(1)])
        ])
        try fixture.write("a", contributes: [
            "interfaces": .object(["o/actions": .array([open, .object(["title": .string("Note")])])])
        ])
        let sut = try fixture.deckit().catalog

        // When
        let handed = try sut.declarations(to: "o/actions", for: "o")

        // Then
        #expect(handed.map(\.mod) == ["a", "a"])
        #expect(handed.map(\.name) == ["A", "A"])
        #expect(handed.map(\.entry) == [open, .object(["title": .string("Note")])])
    }

    @Test("what is declared to an interface is handed to its owner only")
    func notOwnerIsRefused() throws {
        // Given
        try fixture.write("o", provides: ["o/actions"])
        try fixture.write("a", contributes: ["interfaces": .object(["o/actions": .array([.object([:])])])])
        let sut = try fixture.deckit().catalog

        // When
        let refused = #expect(throws: DeclarationError.self) { try sut.declarations(to: "o/actions", for: "a") }

        // Then
        #expect(refused == .notOwner(interface: "o/actions", mod: "a"))
    }

    @Test("declarations that are not entry lists by interface are told as the mod is read and left out", arguments: [
        (.array([]), "contributes \"interfaces\" must be an object of entry lists by interface"),
        (
            .object(["o/actions": .array([.string("x")])]),
            "contributes \"interfaces\" \"o/actions\" must be a list of objects"
        )
    ] as [(JSONValue, String)])
    func malformedDeclarationIsTold(declared: JSONValue, problem: String) throws {
        // Given
        try fixture.write("o", provides: ["o/actions"])
        try fixture.write("a", contributes: ["interfaces": declared])
        let sut = try fixture.deckit()

        // When
        let problems = sut.readCatalog().first { mod in mod.manifest.id == "a" }?.declarationProblems

        // Then
        #expect(problems == [problem])
        #expect(try sut.catalog.declarations(to: "o/actions", for: "o").isEmpty)
    }

    // MARK: - Private
}
