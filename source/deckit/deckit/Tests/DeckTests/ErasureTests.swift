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
    private let state: State
    private let modState: ModState
    private let sut: Erasure

    // MARK: - Initializer
    init() throws {
        home = FileManager.default.temporaryDirectory.appending(path: "erasure-tests-\(UUID().uuidString)")
        let store = Store()
        record = Record(folder: home.appending(path: "records"), store: store)
        dataFolder = DataFolder(folder: home.appending(path: "data"), store: store)
        state = State(root: home.appending(path: "state"), store: store)
        modState = ModState(root: home.appending(path: "mod-state"), store: store)
        try modState.reserve("layer")
        let storage = ModStorage(dataFolder: dataFolder, record: record, modState: modState, store: store)
        sut = Erasure(storage: storage, state: state, store: store)
    }

    // MARK: - Test
    @Test("erasing takes the mod's data folder, records and what a layer keeps of it, and notes it until it is cleared")
    func eraseTakesWhatDeckKeeps() throws {
        // Given
        try keep("notes")
        try keep("finder")

        // When
        try sut.erase(mod: "notes")
        try sut.erase(mod: "notes")

        // Then
        #expect(!exists("data/notes"))
        #expect(!exists("records/notes"))
        #expect(!exists("mod-state/layer/notes.json"))
        #expect(exists("data/finder"))
        #expect(exists("records/finder"))
        #expect(exists("mod-state/layer/finder.json"))
        #expect(sut.uncleared() == ["notes"])
    }

    @Test("what can be erased is, though one fails, and the mod stays noted")
    func eraseTriesEach() throws {
        // Given
        try keep("notes")
        let data = home.appending(path: "data").path(percentEncoded: false)
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: data)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: data) }

        // When
        let erased = Result { try sut.erase(mod: "notes") }

        // Then
        #expect(throws: (any Error).self) { try erased.get() }
        #expect(exists("data/notes"))
        #expect(!exists("records/notes"))
        #expect(!exists("mod-state/layer/notes.json"))
        #expect(sut.uncleared() == ["notes"])
    }

    @Test("a mod cleared is no longer noted, and what another is stays")
    func clearedTakesTheNote() throws {
        // Given
        try sut.erase(mod: "notes")
        try sut.erase(mod: "finder")

        // When
        try sut.cleared(mod: "notes")

        // Then
        #expect(sut.uncleared() == ["finder"])
        #expect(try state.read(folder: nil, key: "uncleared") == #"["finder"]"#)
    }

    @Test("an id that is no mod's is refused, and nothing is noted")
    func noModIsRefused() throws {
        // Given
        try keep("notes")

        // When
        let erased = Result { try sut.erase(mod: "../notes") }

        // Then
        #expect(throws: ErasureError.notAMod("../notes")) { try erased.get() }
        #expect(sut.uncleared().isEmpty)
        #expect(exists("data/notes"))
    }

    // MARK: - Private
    private func keep(_ id: String) throws {
        let data = home.appending(path: "data/\(id)")
        try FileManager.default.createDirectory(at: data, withIntermediateDirectories: true)
        try Data("x".utf8).write(to: data.appending(path: "file.txt"))
        try record.write(mod: id, key: "tabs", text: "[]")
        try modState.write("layer", mod: id, text: "{}")
    }

    private func exists(_ path: String) -> Bool {
        FileManager.default.fileExists(atPath: home.appending(path: path).path(percentEncoded: false))
    }
}
