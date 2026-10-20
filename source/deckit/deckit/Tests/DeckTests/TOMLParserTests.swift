//
//  TOMLParserTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("TOMLParser")
struct TOMLParserTests {
    // MARK: - Property
    private let sut = TOMLParser()

    // MARK: - Initializer
    // MARK: - Test
    @Test("a manifest's kinds of values are read, tables, quoted keys and arrays over lines among them")
    func testThatValuesAreRead() throws {
        // Given
        let text = """
            \u{FEFF}id = "notes" # a comment
            count = -3
            on = true
            path = 'C:\\raw'
            list = [
                "a", # first
                'b',
            ]

            [permissions]
            "deckit.mods" = "to list \\"them\\" \\u00e9"
            """

        // When
        let table = try sut.parse(text)

        // Then
        #expect(
            table == [
                "id": .string("notes"),
                "count": .integer(-3),
                "on": .boolean(true),
                "path": .string("C:\\raw"),
                "list": .array([.string("a"), .string("b")]),
                "permissions": .table(["deckit.mods": .string("to list \"them\" é")])
            ]
        )
    }

    @Test(
        "what the subset does not read is refused by line",
        arguments: [
            ("id = 1.5", "line 1: not a value this reads: 1.5"),
            ("a = 1\na = 2", "line 2: a is set twice"),
            ("[a]\n[a]", "line 2: [a] appears twice"),
            ("a.b = 1", "line 1: a name with a dot is written in quotes: \"a.b\" = …"),
            ("just text", "line 1: expected key = value"),
            ("a = \"x\" y", "line 1: unexpected text after the value of a"),
            ("a = \"\\q\"", "line 1: unknown escape \\q"),
            ("a = [1 2]", "line 1: expected , or ] in an array"),
            ("a = " + String(repeating: "[", count: 10_000), "line 1: arrays nest at most 32 deep")
        ]
    )
    func testThatUnreadTextIsRefused(text: String, message: String) {
        // Given
        // When
        let error = #expect(throws: TOMLError.self) { try sut.parse(text) }

        // Then
        #expect(error?.message == message)
    }
}
