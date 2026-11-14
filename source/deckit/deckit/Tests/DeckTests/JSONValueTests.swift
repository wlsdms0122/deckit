//
//  JSONValueTests.swift
//  DeckTests
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("JSONValue")
struct JSONValueTests {
    // MARK: - Property
    private static let malformed = [
        "",
        "{",
        "{\"a\" 1}",
        "01",
        "1.",
        "-",
        "1e",
        "1e400",
        "tru",
        "\"a",
        "\"\u{1}\"",
        #""\x""#,
        #""\ud800""#,
        #""\udc00""#,
        #""\u+fff""#,
        "1 2",
        "'a'",
        String(repeating: "[", count: 514) + String(repeating: "]", count: 514)
    ]

    // MARK: - Initializer
    // MARK: - Test
    @Test("each kind of value is read, with white space around it, escapes in strings, and booleans apart from numbers")
    func valuesAreRead() throws {
        // Given
        let text = #" { "a" : [null, true, false, 0, 1, -1.5e2, 12], "b": "q\"\\\/\b\f\n\r\té😀", "c": {} } "#

        // When
        let sut = try JSONValue(data: Data(text.utf8))

        // Then
        #expect(
            sut == .object([
                "a": .array([.null, .bool(true), .bool(false), .number(0), .number(1), .number(-150), .number(12)]),
                "b": .string("q\"\\/\u{8}\u{C}\n\r\t\u{E9}\u{1F600}"),
                "c": .object([:])
            ])
        )
    }

    @Test("a value that is not an array or an object is read on its own")
    func fragmentIsRead() throws {
        // Given
        let text = "true"

        // When
        let sut = try JSONValue(data: Data(text.utf8))

        // Then
        #expect(sut == .bool(true))
    }

    @Test("two names of one canonical form are two members, each with its value")
    func namesAreKeptBySequence() throws {
        // Given
        let text = "{\"caf\u{E9}\":1,\"cafe\u{301}\":2,\"view\":{\"\u{212B}\":3,\"\u{C5}\":4}}"

        // When
        let sut = try JSONValue(data: Data(text.utf8))

        // Then
        #expect(
            sut == .object([
                "caf\u{E9}": .number(1),
                "cafe\u{301}": .number(2),
                "view": .object(["\u{212B}": .number(3), "\u{C5}": .number(4)])
            ])
        )
    }

    @Test("a text that is not one JSON value is refused as corrupted data", arguments: malformed)
    func malformedIsRefused(text: String) {
        // Given
        // When
        let sut = Result { try JSONValue(data: Data(text.utf8)) }

        // Then
        #expect {
            try sut.get()
        } throws: { error in
            guard case let DecodingError.dataCorrupted(context) = error else { return false }
            return context.codingPath.isEmpty
        }
    }
}
