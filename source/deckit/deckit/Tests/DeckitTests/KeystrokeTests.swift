//
//  KeystrokeTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deckit

@Suite("Keystroke")
struct KeystrokeTests {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Test
    @Test("a spec is read as one spelling, and one with a second key or an unknown word is no chord")
    func specsAreRead() {
        // Given
        let written = ["Shift+Mod+G", "option+control+left", "mod+a+b", "cmd+nope", "cmd+", "f12"]

        // When
        let specs = written.map { spec in Keystroke(spec: spec)?.spec }

        // Then
        #expect(specs == ["shift+cmd+g", "ctrl+alt+left", nil, nil, nil, "f12"])
    }

    @Test("a chord is labeled as the platform writes it")
    func chordsAreLabeled() throws {
        // Given
        let keystrokes = try ["ctrl+alt+shift+cmd+t", "cmd+escape", "cmd+["].map { spec in
            try #require(Keystroke(spec: spec))
        }

        // When
        let labels = keystrokes.map(\.label)

        // Then
        #expect(labels == ["⌃⌥⇧⌘T", "⌘⎋", "⌘["])
    }

    @Test("a global chord has ⌘, ⌃ or ⌥, and none a text field uses")
    func globalChordsAreJudged() throws {
        // Given
        let specs = ["cmd+shift+g", "shift+g", "cmd+c", "cmd+left", "ctrl+c"]

        // When
        let fits = try specs.map { spec in try #require(Keystroke(spec: spec)).fitsGlobal }

        // Then
        #expect(fits == [true, false, false, false, true])
    }

    @Test("a keystroke typed to be bound comes to what recording does with it")
    func recordedKeysAreJudged() {
        // Given
        let typed = [
            Keystroke(code: "Escape", meta: false, control: false, shift: false, alt: false),
            Keystroke(code: "Backspace", meta: false, control: false, shift: false, alt: false),
            Keystroke(code: "MetaLeft", meta: true, control: false, shift: false, alt: false),
            Keystroke(code: "KeyA", meta: false, control: false, shift: true, alt: false),
            Keystroke(code: "F5", meta: false, control: false, shift: false, alt: false),
            Keystroke(code: "KeyK", meta: true, control: false, shift: false, alt: false),
            Keystroke(code: "IntlRo", meta: true, control: false, shift: false, alt: false)
        ]

        // When
        let recorded = typed.map(RecordedKey.init)

        // Then
        #expect(
            recorded == [
                .cancel,
                .clear,
                .pending,
                .refused("Add ⌘, ⌃ or ⌥"),
                .spec("f5"),
                .spec("cmd+k"),
                .refused("That key cannot be bound")
            ]
        )
    }

    // MARK: - Private
}
