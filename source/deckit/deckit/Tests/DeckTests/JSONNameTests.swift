//
//  JSONNameTests.swift
//  DeckTests
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("JSONName")
struct JSONNameTests {
    // MARK: - Property
    private let sut: JSONName = "caf\u{E9}"

    // MARK: - Initializer
    // MARK: - Test
    @Test("two names of one canonical form are two names, and an object holds a member under each")
    func canonicalFormsAreTwoNames() {
        // Given
        let decomposed: JSONName = "cafe\u{301}"

        // When
        let object: [JSONName: Int] = [sut: 1, decomposed: 2]

        // Then
        #expect(sut != decomposed)
        #expect(sut == JSONName("caf\u{E9}"))
        #expect(object.count == 2)
        #expect(object[sut] == 1)
        #expect(object[decomposed] == 2)
    }

    @Test("names come in the order of their scalar values, the shorter first where one begins the other")
    func namesAreOrderedByScalarValues() {
        // Given
        let names: [JSONName] = ["\u{1D400}", "cafe", "\u{FF21}", sut, "cafe\u{301}", "B"]

        // When
        let sorted = names.sorted()

        // Then
        #expect(sorted == ["B", "cafe", "cafe\u{301}", sut, "\u{FF21}", "\u{1D400}"])
    }
}
