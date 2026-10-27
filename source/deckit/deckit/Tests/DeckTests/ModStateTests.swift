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
        try sut.reserve("configuration")
        try sut.reserve("pins")

        // When
        try sut.write("configuration", mod: "notes", text: #"{"wrap":true}"#)
        try sut.write("pins", mod: "finder", text: "[]")

        // Then
        #expect(sut.read("configuration", mod: "notes") == #"{"wrap":true}"#)
        #expect(sut.read("pins", mod: "notes") == nil)
        #expect(sut.kept(mod: "notes") == ["configuration"])
        #expect(sut.kept(mod: "finder") == ["pins"])
        #expect(FileManager.default.fileExists(atPath: home.appending(path: "mod-state/pins/finder.json").path()))
    }

    @Test("a name reserved again, or one that is no name, is refused")
    func nameIsReservedOnce() throws {
        // Given
        try sut.reserve("configuration")

        // When
        let again = Result { try sut.reserve("configuration") }
        let unnamed = Result { try sut.reserve("../up") }

        // Then
        #expect(throws: ModStateError.reserved("configuration")) { try again.get() }
        #expect(throws: ModStateError.notAName("../up")) { try unnamed.get() }
    }

    @Test("erasing a mod takes what every name keeps of it, and nothing of another mod's")
    func eraseTakesEveryName() throws {
        // Given
        try sut.reserve("configuration")
        try sut.reserve("pins")
        try sut.write("configuration", mod: "notes", text: "{}")
        try sut.write("pins", mod: "notes", text: "[]")
        try sut.write("pins", mod: "finder", text: "[]")

        // When
        try sut.erase(mod: "notes")
        try sut.erase(mod: "never")

        // Then
        #expect(sut.kept(mod: "notes").isEmpty)
        #expect(sut.kept(mod: "finder") == ["pins"])
    }
}
