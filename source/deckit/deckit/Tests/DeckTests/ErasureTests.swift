//
//  ErasureTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("Erasure")
struct ErasureTests {
    // MARK: - Property
    private let home: URL
    private let record: Record
    private let dataFolder: DataFolder
    private let principalState: PrincipalState
    private let sut: Erasure

    // MARK: - Initializer
    init() throws {
        home = FileManager.default.temporaryDirectory.appending(path: "erasure-tests-\(UUID().uuidString)")
        let store = Store()
        record = Record(folder: home.appending(path: "records"), store: store)
        dataFolder = DataFolder(folder: home.appending(path: "data"), store: store)
        principalState = PrincipalState(root: home.appending(path: "principal-state"), store: store)
        try principalState.reserve("layer")
        let storage = PrincipalStorage(
            dataFolder: dataFolder,
            record: record,
            principalState: principalState,
            store: store
        )
        let settings = DeckSettings(file: home.appending(path: "deck.json"), store: store)
        sut = Erasure(storage: storage, settings: settings, store: store)
    }

    // MARK: - Test
    @Test("erasing takes the principal's data folder, records and what a layer keeps of it, and notes it until cleared")
    func eraseTakesWhatDeckKeeps() throws {
        // Given
        try keep("notes")
        try keep("other")

        // When
        try sut.erase(principal: "notes")
        try sut.erase(principal: "notes")

        // Then
        #expect(!exists("data/notes"))
        #expect(!exists("records/notes"))
        #expect(!exists("principal-state/layer/notes.json"))
        #expect(exists("data/other"))
        #expect(exists("records/other"))
        #expect(exists("principal-state/layer/other.json"))
        #expect(sut.uncleared() == ["notes"])
    }

    @Test("what can be erased is, though one fails, and the principal stays noted")
    func eraseTriesEach() throws {
        // Given
        try keep("notes")
        let data = home.appending(path: "data").path(percentEncoded: false)
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: data)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: data) }

        // When
        let erased = Result { try sut.erase(principal: "notes") }

        // Then
        #expect(throws: (any Error).self) { try erased.get() }
        #expect(exists("data/notes"))
        #expect(!exists("records/notes"))
        #expect(!exists("principal-state/layer/notes.json"))
        #expect(sut.uncleared() == ["notes"])
    }

    @Test("a principal cleared is no longer noted, and what another is stays, in deck.json under uncleared")
    func clearedTakesTheNote() throws {
        // Given
        try sut.erase(principal: "notes")
        try sut.erase(principal: "other")

        // When
        try sut.cleared(principal: "notes")

        // Then
        #expect(sut.uncleared() == ["other"])
        let settings = try Data(contentsOf: home.appending(path: "deck.json"))
        #expect(try JSONDecoder().decode([String: [String]].self, from: settings) == ["uncleared": ["other"]])
    }

    @Test("an id that is no principal's is refused, and nothing is noted")
    func noModIsRefused() throws {
        // Given
        try keep("notes")

        // When
        let erased = Result { try sut.erase(principal: "../notes") }

        // Then
        #expect(throws: ErasureError.notAPrincipal("../notes")) { try erased.get() }
        #expect(sut.uncleared().isEmpty)
        #expect(exists("data/notes"))
    }

    // MARK: - Private
    private func keep(_ id: String) throws {
        let data = home.appending(path: "data/\(id)")
        try FileManager.default.createDirectory(at: data, withIntermediateDirectories: true)
        try Data("x".utf8).write(to: data.appending(path: "file.txt"))
        try record.write(principal: id, key: "tabs", text: "[]")
        try principalState.write("layer", principal: id, text: "{}")
    }

    private func exists(_ path: String) -> Bool {
        FileManager.default.fileExists(atPath: home.appending(path: path).path(percentEncoded: false))
    }
}
