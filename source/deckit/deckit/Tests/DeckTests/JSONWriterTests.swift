//
//  JSONWriterTests.swift
//  DeckTests
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("JSONWriter")
struct JSONWriterTests {
    // MARK: - Property
    private struct Sample: Encodable {
        let id = 3
        let large = Int64.max
        let reason: String? = nil
        let path = "a/b \"q\" \\ \n\t\r\u{8}\u{C}\u{1}\u{1F}\u{7F}\u{2028}\u{E9}\u{1F600}"
        let numbers = [0.1, 12, -0.0, 1e21, 1e20, 123_456_789_012.5, 1e-7, 3e15, 2.5]
        let empty: [String: [Int]] = ["a10": [], "a9": [], "B": []]
        let nested = [[Int]()]
    }

    private let sut = JSONWriter()

    // MARK: - Initializer
    // MARK: - Test
    @Test("a value whose names are apart is written as the JSON value JSONEncoder writes, compact or pretty")
    func valueIsWrittenAsFoundationWritesIt() throws {
        // Given
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let pretty = JSONWriter(options: [.prettyPrinted, .withoutEscapingSlashes])

        // When
        let written = try sut.write(Sample())
        let writtenPretty = try pretty.write(Sample())

        // Then
        let expected = try JSONValue(data: encoder.encode(Sample()))
        #expect(try JSONValue(data: written) == expected)
        #expect(try JSONValue(data: writtenPretty) == expected)
        #expect(!written.contains(UInt8(ascii: "\n")))
        let layout = "{\n  \"empty\" : {\n    \"a9\" : [\n\n    ],"
        #expect(String(decoding: writtenPretty, as: UTF8.self).hasPrefix(layout))
    }

    @Test("two names of one canonical form are two members, in a fixed order")
    func namesAreKeptBySequence() throws {
        // Given
        let value = JSONValue.object(["view": .object(["caf\u{E9}": .number(1), "cafe\u{301}": .number(2)])])

        // When
        let written = try sut.write(value)

        // Then
        #expect(String(decoding: written, as: UTF8.self) == "{\"view\":{\"cafe\u{301}\":2,\"caf\u{E9}\":1}}")
        #expect(try JSONValue(data: written) == value)
    }

    @Test("a number JSON does not write is refused")
    func nonFiniteIsRefused() {
        // Given
        // When
        let written = Result { try sut.write(JSONValue.number(.infinity)) }

        // Then
        #expect(throws: EncodingError.self) { try written.get() }
    }
}
