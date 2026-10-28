//
//  URLsFieldTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/28/26.
//

import Foundation
import Testing
import Deck
@testable import Deckit

@Suite("URLsField")
struct URLsFieldTests {
    // MARK: - Property
    private static let notAPattern =
        #"is not an address pattern; one is "<scheme>:*" or "<scheme>://<host>/<path>*", its * only at the end"#
    private static let wrongs: [(TOMLValue, String)] = [
        (
            .array([]),
            #"urls must be a list of address patterns, as urls = ["https://github.com/*", "board:*"], "#
                + #"or ["*"] for every address"#
        ),
        (.array([.string("https://github.com*")]), #"urls: "https://github.com*" "# + notAPattern),
        (.array([.string("https://*")]), #"urls: "https://*" "# + notAPattern),
        (.array([.string("https:")]), #"urls: "https:" "# + notAPattern),
        (.array([.string("javascript:*")]), #"urls: "javascript:*" is not a place; nothing opens it"#),
        (.array([.string("*"), .string("https:*")]), #"urls: "*" already takes every address, so it stands alone"#)
    ]

    private let sut = URLsField()

    // MARK: - Initializer
    // MARK: - Test
    @Test("what is wrong with a mod's urls is said", arguments: wrongs)
    func wrongURLsAreSaid(written: TOMLValue, problem: String) {
        // Given
        // When
        let said = sut.problem(of: written)

        // Then
        #expect(said == problem)
    }

    @Test("a pattern is read as written, and matches with its scheme and host in any case and its path as written")
    func patternIsRead() throws {
        // Given
        let written = TOMLValue.array([.string("HTTPS://GitHub.com/Deckit*"), .string("board:*"), .string("board:*")])

        // When
        let read = sut.read(written)
        let pattern = try #require(read.first)

        // Then
        #expect(sut.problem(of: written) == nil)
        #expect(read.map(\.written) == ["HTTPS://GitHub.com/Deckit*", "board:*"])
        #expect(pattern.matches("https://github.COM/Deckit/issues"))
        #expect(!pattern.matches("https://github.com/deckit"))
        #expect(!pattern.matches("https://github.com.evil/Deckit"))
    }
}
