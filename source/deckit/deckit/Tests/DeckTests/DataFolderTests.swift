//
//  DataFolderTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("DataFolder")
struct DataFolderTests {
    // MARK: - Property
    private let folder: URL
    private let sut: DataFolder

    // MARK: - Initializer
    init() {
        folder = FileManager.default.temporaryDirectory.appending(path: "data-tests-\(UUID().uuidString)")
        sut = DataFolder(folder: folder, store: Store())
    }

    // MARK: - Test
    @Test("count is every file of the mod's folder, its folders' too, and notes the hidden ones")
    func countWalksFolders() throws {
        // Given
        let notes = folder.appending(path: "notes")
        try FileManager.default.createDirectory(at: notes.appending(path: "inner"), withIntermediateDirectories: true)
        try Data().write(to: notes.appending(path: "a"))
        try Data().write(to: notes.appending(path: "inner/b"))
        try Data().write(to: notes.appending(path: ".c"))

        // When
        let count = try sut.count(mod: "notes")

        // Then
        #expect(count == DataCount(count: 2, capped: false, hidden: true))
    }

    @Test("an id that is no mod's is refused, and erasing takes the mod's folder")
    func idIsHeldToRule() throws {
        // Given
        let notes = folder.appending(path: "notes")
        try FileManager.default.createDirectory(at: notes, withIntermediateDirectories: true)

        // When
        try sut.erase(mod: "notes")
        let counted = Result { try sut.count(mod: "../x") }

        // Then
        #expect(throws: DataFolderError.notAMod("../x")) { try counted.get() }
        #expect(!FileManager.default.fileExists(atPath: notes.path(percentEncoded: false)))
    }
}
