//
//  DeckSettingsTests.swift
//  DeckTests
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("DeckSettings")
struct DeckSettingsTests {
    // MARK: - Property
    private let file = FileManager.default.temporaryDirectory
        .appending(path: "deck-settings-tests-\(UUID().uuidString)")
        .appending(path: "deck.json")
    private let store = Store()
    private let sut: DeckSettings

    // MARK: - Initializer
    init() {
        sut = DeckSettings(file: file, store: store)
    }

    // MARK: - Test
    @Test("what the file holds is kept as written, two names of one canonical form as two, when a value is written")
    func otherNamesAreKept() throws {
        // Given
        try store.write("{\"other\":{\"caf\u{E9}\":1,\"cafe\u{301}\":2}}", to: file)

        // When
        try sut.write(["pins": .object([:])])

        // Then
        #expect(sut.value(of: "other") == .object(["caf\u{E9}": .number(1), "cafe\u{301}": .number(2)]))
        #expect(sut.value(of: "pins") == .object([:]))
        #expect(
            store.read(file)
                == "{\n  \"other\" : {\n    \"cafe\u{301}\" : 2,\n    \"caf\u{E9}\" : 1\n  },\n  \"pins\" : {\n\n  }\n}"
        )
    }

    @Test("a file that does not read as a JSON object is not written")
    func unreadableIsNotWritten() throws {
        // Given
        try store.write("[1]", to: file)

        // When
        let written = Result { try sut.write(["pins": .object([:])]) }

        // Then
        #expect(throws: DeckSettingsError.unreadable("deck.json")) { try written.get() }
        #expect(store.read(file) == "[1]")
    }
}
