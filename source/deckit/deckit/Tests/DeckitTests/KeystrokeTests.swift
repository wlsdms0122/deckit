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
    @Test(
        "a spec is read as one spelling, and one with a second key or an unknown word is no chord",
        arguments: [
            ("Shift+Mod+G", "shift+cmd+g"),
            ("option+control+left", "ctrl+alt+left"),
            ("mod+a+b", nil),
            ("cmd+nope", nil),
            ("cmd+", nil),
            ("f12", "f12")
        ]
    )
    func specIsRead(written: String, spec: String?) {
        // Given
        // When
        let sut = Keystroke(spec: written)

        // Then
        #expect(sut?.spec == spec)
    }

    @Test(
        "a chord is labeled as the platform writes it",
        arguments: [
            ("ctrl+alt+shift+cmd+t", "⌃⌥⇧⌘T"),
            ("cmd+escape", "⌘⎋"),
            ("cmd+[", "⌘[")
        ]
    )
    func chordIsLabeled(spec: String, label: String) throws {
        // Given
        let sut = try #require(Keystroke(spec: spec))

        // When
        let labeled = sut.label

        // Then
        #expect(labeled == label)
    }

    @Test(
        "a global chord has ⌘, ⌃ or ⌥, and none a text field uses",
        arguments: [
            ("cmd+shift+g", true),
            ("shift+g", false),
            ("cmd+c", false),
            ("cmd+left", false),
            ("ctrl+c", true)
        ]
    )
    func globalChordIsJudged(spec: String, fits: Bool) throws {
        // Given
        let sut = try #require(Keystroke(spec: spec))

        // When
        let fitsGlobal = sut.fitsGlobal

        // Then
        #expect(fitsGlobal == fits)
    }

    @Test(
        "a keystroke typed to be bound comes to what recording does with it",
        arguments: [
            (Keystroke(code: "Escape", meta: false, control: false, shift: false, alt: false), RecordedKey.cancel),
            (Keystroke(code: "Backspace", meta: false, control: false, shift: false, alt: false), .clear),
            (Keystroke(code: "MetaLeft", meta: true, control: false, shift: false, alt: false), .pending),
            (
                Keystroke(code: "KeyA", meta: false, control: false, shift: true, alt: false),
                .refused("Add ⌘, ⌃ or ⌥")
            ),
            (Keystroke(code: "F5", meta: false, control: false, shift: false, alt: false), .spec("f5")),
            (Keystroke(code: "KeyK", meta: true, control: false, shift: false, alt: false), .spec("cmd+k")),
            (
                Keystroke(code: "IntlRo", meta: true, control: false, shift: false, alt: false),
                .refused("That key cannot be bound")
            )
        ]
    )
    func recordedKeyIsJudged(typed: Keystroke, recorded: RecordedKey) {
        // Given
        // When
        let sut = RecordedKey(typed)

        // Then
        #expect(sut == recorded)
    }

    // MARK: - Private
}
