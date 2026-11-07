//
//  JSONParserTests.swift
//  DeckTests
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("JSONParser")
struct JSONParserTests {
    // MARK: - Property
    private static let malformed = [
        "",
        "{",
        "[1,]",
        "{\"a\" 1}",
        "{\"a\":1,}",
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
        String(repeating: "[", count: 513) + String(repeating: "]", count: 513)
    ]

    private let sut = JSONParser()

    // MARK: - Initializer
    // MARK: - Test
    @Test("each kind of value is read, with white space around it and escapes in strings")
    func valuesAreRead() throws {
        // Given
        let text = #" { "a" : [null, true, false, 0, -1.5e2, 12], "b": "q\"\\\/\b\f\n\r\té😀", "c": {} } "#

        // When
        let value = try sut.parse(text)

        // Then
        #expect(
            value == .object([
                "a": .array([.null, .bool(true), .bool(false), .number(0), .number(-150), .number(12)]),
                "b": .string("q\"\\/\u{8}\u{C}\n\r\t\u{E9}\u{1F600}"),
                "c": .object([:])
            ])
        )
    }

    @Test("two names of one canonical form are two members, and a name written twice keeps its last value")
    func namesAreKeptBySequence() throws {
        // Given
        let text = "{\"caf\u{E9}\":1,\"cafe\u{301}\":2,\"a\":1,\"a\":3}"

        // When
        let value = try sut.parse(text)

        // Then
        #expect(value == .object(["caf\u{E9}": .number(1), "cafe\u{301}": .number(2), "a": .number(3)]))
    }

    @Test("a text that is not one JSON value is refused as corrupted data", arguments: malformed)
    func malformedIsRefused(text: String) {
        // Given
        // When
        let parsed = Result { try sut.parse(text) }

        // Then
        #expect {
            try parsed.get()
        } throws: { error in
            guard case DecodingError.dataCorrupted = error else { return false }
            return true
        }
    }
}
