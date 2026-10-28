//
//  ModStateTests.swift
//  DeckTests
//
//  Created by JSilver on 10/27/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("ModState")
struct ModStateTests {
    // MARK: - Property
    private let home: URL
    private let sut: ModState

    // MARK: - Initializer
    init() {
        home = FileManager.default.temporaryDirectory.appending(path: "mod-state-tests-\(UUID().uuidString)")
        sut = ModState(root: home.appending(path: "mod-state"), store: Store())
    }

    // MARK: - Test
    @Test("what a name keeps of a mod is its own, one file a mod in the name's folder")
    func eachNameKeepsItsOwn() throws {
        // Given
        try sut.reserve("layer")
        try sut.reserve("other-layer")

        // When
        try sut.write("layer", mod: "notes", text: #"{"wrap":true}"#)
        try sut.write("other-layer", mod: "other", text: "[]")

        // Then
        #expect(sut.read("layer", mod: "notes") == #"{"wrap":true}"#)
        #expect(sut.read("other-layer", mod: "notes") == nil)
        #expect(sut.kept(mod: "notes") == ["layer"])
        #expect(sut.kept(mod: "other") == ["other-layer"])
        #expect(FileManager.default.fileExists(atPath: home.appending(path: "mod-state/other-layer/other.json").path()))
    }

    @Test("a name reserved again, or one that is no name, is refused")
    func nameIsReservedOnce() throws {
        // Given
        try sut.reserve("layer")

        // When
        let again = Result { try sut.reserve("layer") }
        let unnamed = Result { try sut.reserve("../up") }

        // Then
        #expect(throws: ModStateError.reserved("layer")) { try again.get() }
        #expect(throws: ModStateError.notAName("../up")) { try unnamed.get() }
    }

    @Test("erasing a mod takes what every name keeps of it, and nothing of another mod's")
    func eraseTakesEveryName() throws {
        // Given
        try sut.reserve("layer")
        try sut.reserve("other-layer")
        try sut.write("layer", mod: "notes", text: "{}")
        try sut.write("other-layer", mod: "notes", text: "[]")
        try sut.write("other-layer", mod: "other", text: "[]")

        // When
        try sut.erase(mod: "notes")
        try sut.erase(mod: "never")

        // Then
        #expect(sut.kept(mod: "notes").isEmpty)
        #expect(sut.kept(mod: "other") == ["other-layer"])
    }
}
