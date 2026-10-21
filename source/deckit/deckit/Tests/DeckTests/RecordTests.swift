//
//  RecordTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("Record")
struct RecordTests {
    // MARK: - Property
    private let folder: URL
    private let sut: Record

    // MARK: - Initializer
    init() {
        folder = FileManager.default.temporaryDirectory.appending(path: "record-tests-\(UUID().uuidString)")
        sut = Record(folder: folder, store: Store())
    }

    // MARK: - Test
    @Test("a record reads back the text it was written with")
    func recordReadsBackItsText() throws {
        // Given
        let text = #"{"b":1,"a":[true,null]}"#

        // When
        try sut.write(mod: "notes", key: "tabs", text: text)

        // Then
        #expect(try sut.read(mod: "notes", key: "tabs") == text)
    }

    @Test("a key never written reads as nil")
    func missingRecordReadsAsNil() throws {
        // Given
        // When
        let text = try sut.read(mod: "notes", key: "tabs")

        // Then
        #expect(text == nil)
    }

    @Test("a mod reads only its own records")
    func modReadsOnlyItsOwnRecords() throws {
        // Given
        try sut.write(mod: "notes", key: "tabs", text: "1")

        // When
        let text = try sut.read(mod: "finder", key: "tabs")

        // Then
        #expect(text == nil)
    }

    @Test("keys lists a mod's records in order")
    func keysListsRecordsInOrder() throws {
        // Given
        try sut.write(mod: "notes", key: "b", text: "1")
        try sut.write(mod: "notes", key: "a", text: "2")
        try sut.write(mod: "finder", key: "c", text: "3")

        // When
        let keys = try sut.keys(mod: "notes")

        // Then
        #expect(keys == ["a", "b"])
    }

    @Test("a removed record is gone, and removing one never written is no error")
    func removedRecordIsGone() throws {
        // Given
        try sut.write(mod: "notes", key: "tabs", text: "1")

        // When
        try sut.remove(mod: "notes", key: "tabs")
        try sut.remove(mod: "notes", key: "never")

        // Then
        #expect(try sut.read(mod: "notes", key: "tabs") == nil)
        #expect(try sut.keys(mod: "notes").isEmpty)
    }

    @Test("erasing takes every record of the mod's and no other's")
    func eraseTakesOnlyTheModsRecords() throws {
        // Given
        try sut.write(mod: "notes", key: "a", text: "1")
        try sut.write(mod: "finder", key: "a", text: "2")

        // When
        try sut.erase(mod: "notes")
        try sut.erase(mod: "never")

        // Then
        #expect(try sut.keys(mod: "notes").isEmpty)
        #expect(try sut.read(mod: "finder", key: "a") == "2")
    }

    @Test("count is every file of the mod's records but the hidden ones, and says whether there are any")
    func countIsEveryFile() throws {
        // Given
        try sut.write(mod: "notes", key: "a", text: "1")
        try sut.write(mod: "notes", key: "b", text: "2")
        try Data().write(to: folder.appending(path: "notes/.hidden"))

        // When
        let count = try sut.count(mod: "notes")

        // Then
        #expect(count == RecordCount(count: 2, hidden: true))
        #expect(try sut.count(mod: "never") == RecordCount(count: 0, hidden: false))
    }

    @Test("a key that would not name a file is refused as KEY", arguments: ["", "Tabs", "a/b", "a..b", ".a"])
    func badKeyIsRefused(key: String) {
        // Given
        // When
        // Then
        #expect(throws: RecordError.notAKey(key)) {
            try sut.write(mod: "notes", key: key, text: "1")
        }
    }

    @Test("count is refused for an id that is no mod's", arguments: ["../notes", "Notes"])
    func countRefusesOtherIds(mod: String) {
        // Given
        // When
        // Then
        #expect(throws: RecordError.notAMod(mod)) { try sut.count(mod: mod) }
    }
}
