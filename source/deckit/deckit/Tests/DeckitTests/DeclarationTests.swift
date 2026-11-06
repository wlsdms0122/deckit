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
        try fixture.write("a", contributes: """
            [[contributes."o/actions"]]
            title = "Open"
            command = "open"
            args = { x = 1 }

            [[contributes."o/actions"]]
            title = "Note"
            """)
        let sut = try fixture.deckit().catalog
        let open: JSONValue = .object([
            "title": .string("Open"),
            "command": .string("open"),
            "args": .object(["x": .number(1)])
        ])

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
        try fixture.write("a", contributes: "[contributes]\n\"o/actions\" = [{}]")
        let sut = try fixture.deckit().catalog

        // When
        let refused = #expect(throws: DeclarationError.self) { try sut.declarations(to: "o/actions", for: "a") }

        // Then
        #expect(refused == .notOwner(interface: "o/actions", mod: "a"))
    }

    @Test("as another mod comes to own the interface, it is handed the entries and the one before is refused")
    func newOwnerIsHandedEntries() throws {
        // Given
        try fixture.write("o", provides: ["o/actions"])
        try fixture.write("p", provides: ["o/actions"])
        try fixture.write("a", contributes: "[contributes]\n\"o/actions\" = [{ title = \"Open\" }]")
        let sut = try fixture.deckit().catalog

        // When
        try sut.pin("o/actions", to: "p")

        // Then
        let handed = try sut.declarations(to: "o/actions", for: "p")
        #expect(handed.map(\.entry) == [.object(["title": .string("Open")])])
        #expect(throws: DeclarationError.notOwner(interface: "o/actions", mod: "o")) {
            try sut.declarations(to: "o/actions", for: "o")
        }
    }

    // MARK: - Private
}
