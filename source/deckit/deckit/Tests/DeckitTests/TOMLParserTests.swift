//
//  TOMLParserTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("TOMLParser")
struct TOMLParserTests {
    // MARK: - Property
    private let sut = TOMLParser()

    // MARK: - Initializer
    // MARK: - Test
    @Test("a manifest's kinds of values are read, tables, quoted keys, arrays over lines and inline tables among them")
    func valuesAreRead() throws {
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

            [dependencies]
            dep = { version = "1.0.0", "optional" = true }
            empty = {}
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
                "permissions": .table(["deckit.mods": .string("to list \"them\" é")]),
                "dependencies": .table([
                    "dep": .table(["version": .string("1.0.0"), "optional": .boolean(true)]),
                    "empty": .table([:])
                ])
            ]
        )
    }

    @Test("arrays of tables are read under headers of bare and quoted keys apart at dots, a table on the way made")
    func arraysOfTablesAreRead() throws {
        // Given
        let text = """
            [[contributes."o/actions"]]
            title = "Open"
            args = { x = 1 }

            [[contributes."o/actions"]]
            title = "Note"

            [contributes."o/actions".shown]
            at = "top"

            [ a . "b.c" ]
            d = 1
            """

        // When
        let table = try sut.parse(text)

        // Then
        #expect(
            table == [
                "contributes": .table([
                    "o/actions": .array([
                        .table(["title": .string("Open"), "args": .table(["x": .integer(1)])]),
                        .table(["title": .string("Note"), "shown": .table(["at": .string("top")])])
                    ])
                ]),
                "a": .table(["b.c": .table(["d": .integer(1)])])
            ]
        )
    }

    @Test(
        "what the subset does not read is refused by line",
        arguments: [
            ("id = 1.5", "line 1: not a value this reads: 1.5"),
            ("a = 1\na = 2", "line 2: a is set twice"),
            ("[a]\n[a]", "line 2: [a] appears twice"),
            ("[[a]]\n[a]", "line 2: [a] appears twice"),
            ("[a]\n[[a]]", "line 2: [[a]] appears twice"),
            ("a = [1]\n[[a]]", "line 2: a is set as a value, not as [[a]]"),
            ("a = 1\n[a.b]", "line 2: a is set as a value, not as a table"),
            ("[a b]", "line 1: not a header this reads: [a b]"),
            ("a.b = 1", "line 1: a name with a dot is written in quotes: \"a.b\" = …"),
            ("just text", "line 1: expected key = value"),
            ("a = \"x\" y", "line 1: unexpected text after the value of a"),
            ("a = \"\\q\"", "line 1: unknown escape \\q"),
            ("a = [1 2]", "line 1: expected , or ] in an array"),
            ("a = { b = 1 c = 2 }", "line 1: expected , or } in an inline table"),
            ("a = { b = 1, }", "line 1: an inline table ends with no , before }"),
            ("a = { b = 1, b = 2 }", "line 1: b is set twice"),
            ("a = { b 1 }", "line 1: expected = after b in an inline table"),
            ("a = " + String(repeating: "[", count: 10_000), "line 1: arrays nest at most 32 deep")
        ]
    )
    func unreadTextIsRefused(text: String, message: String) {
        // Given
        // When
        let parsed = Result { try sut.parse(text) }

        // Then
        let error = #expect(throws: TOMLError.self) { try parsed.get() }
        #expect(error?.message == message)
    }
}
