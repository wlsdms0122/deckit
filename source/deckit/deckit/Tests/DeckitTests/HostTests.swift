//
//  HostTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
import Deck
import Deckit

// A Swift host, which reaches deckit only through what Deck and Deckit make public.
@Suite("Host")
struct HostTests {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Test
    @Test("a host builds a deckit, registers a key and reads the keymap, with no JSON")
    func testThatAHostRegistersAKey() throws {
        // Given
        let home = FileManager.default.temporaryDirectory.appending(path: "host-tests-\(UUID().uuidString)")
        let sut = try Deckit(
            home: home,
            ship: [],
            sources: [],
            api: try #require(Version("1.0.0")),
            name: "Host",
            schemeHandlers: [:],
            permissions: []
        )
        _ = sut.deck.readCatalog()
        _ = try sut.deck.reconcile()

        // When
        let keymap = sut.keymap.register(Key(action: "find", spec: "mod+f", label: "Find", global: false))

        // Then
        let find = try #require(keymap.bindings.first)
        #expect(find.binding.id == "@app.find")
        #expect(find.binding.owner.name == "Host")
        #expect(find.binding.keystroke == Keystroke(spec: "mod+f"))
        #expect(find.binding.keystroke?.label == Keystroke(spec: "mod+f")?.label)
        #expect(find.active)
        #expect(find.issues.isEmpty)
    }

    // MARK: - Private
}
