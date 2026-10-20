//
//  SettingTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("Setting")
struct SettingTests {
    // MARK: - Property
    private let folder: URL
    private let sut: Setting

    // MARK: - Initializer
    init() {
        folder = FileManager.default.temporaryDirectory.appending(path: "setting-tests-\(UUID().uuidString)")
        sut = Setting(folder: folder, store: Store())
    }

    // MARK: - Test
    @Test("a value written is saved among the mod's others")
    func testThatValueIsSavedAmongOthers() throws {
        // Given
        _ = try sut.write(mod: "notes", key: "wrap", value: .bool(true))
        _ = try sut.write(mod: "notes", key: "size", value: .number(14))

        // When
        _ = try sut.write(mod: "notes", key: "font", value: .string("Menlo"))

        // Then
        #expect(sut.read(mod: "notes") == ["wrap": .bool(true), "size": .number(14), "font": .string("Menlo")])
        #expect(sut.read(mod: "finder").isEmpty)
    }

    @Test("writing says whether the value changed")
    func testThatWriteSaysWhetherChanged() throws {
        // Given
        _ = try sut.write(mod: "notes", key: "size", value: .number(14))

        // When
        let same = try sut.write(mod: "notes", key: "size", value: .number(14))
        let changed = try sut.write(mod: "notes", key: "size", value: .number(15))

        // Then
        #expect(!same)
        #expect(changed)
    }

    @Test("the file holds the values as JSON, so what deck saved before reads the same")
    func testThatFileIsJSON() throws {
        // Given
        try Data(#"{"wrap":false,"size":12.5,"font":"Menlo"}"#.utf8).write(to: prepared("notes.json"))

        // When
        _ = try sut.write(mod: "notes", key: "size", value: .number(14))

        // Then
        let text = try String(contentsOf: folder.appending(path: "notes.json"), encoding: .utf8)
        #expect(text == #"{"font":"Menlo","size":14,"wrap":false}"#)
    }

    @Test("a file that is not a table of values reads as none saved")
    func testThatUnreadableFileReadsAsNone() throws {
        // Given
        try Data("[1,2]".utf8).write(to: prepared("notes.json"))

        // When
        let values = sut.read(mod: "notes")

        // Then
        #expect(values.isEmpty)
    }

    @Test("erasing takes the mod's values and no other's")
    func testThatEraseTakesOnlyTheModsValues() throws {
        // Given
        _ = try sut.write(mod: "notes", key: "wrap", value: .bool(true))
        _ = try sut.write(mod: "finder", key: "wrap", value: .bool(false))

        // When
        try sut.erase(mod: "notes")
        try sut.erase(mod: "never")

        // Then
        #expect(sut.read(mod: "notes").isEmpty)
        #expect(sut.read(mod: "finder") == ["wrap": .bool(false)])
    }

    // MARK: - Private
    private func prepared(_ name: String) throws -> URL {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appending(path: name)
    }
}
