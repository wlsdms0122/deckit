//
//  StateTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("State")
struct StateTests {
    // MARK: - Property
    private let folder: URL
    private let sut: State

    // MARK: - Initializer
    init() {
        folder = FileManager.default.temporaryDirectory.appending(path: "state-tests-\(UUID().uuidString)")
        sut = State(root: folder, store: Store())
    }

    // MARK: - Test
    @Test("all reads back every key written, the state folder's first, then each folder's by name")
    func allReadsBackEveryKey() throws {
        // Given
        try sut.write(folder: "host", key: "pinned", text: #"["notes"]"#)
        try sut.write(folder: nil, key: "mod-order", text: #"["b","a"]"#)
        try sut.write(folder: "app", key: "size", text: "1")
        try sut.write(folder: nil, key: "mod-order", text: #"["a","b"]"#)

        // When
        let entries = try sut.all()

        // Then
        #expect(
            entries == [
                StateEntry(folder: nil, key: "mod-order", text: #"["a","b"]"#),
                StateEntry(folder: "app", key: "size", text: "1"),
                StateEntry(folder: "host", key: "pinned", text: #"["notes"]"#)
            ]
        )
    }

    @Test("a reserved key of the state folder is written only by its keeper; one of the same name in a folder is not")
    func reservedKeyIsRefused() throws {
        // Given
        sut.reserve("keys")

        // When
        try sut.write(reserved: "keys", text: "[]")
        try sut.write(folder: "host", key: "keys", text: "1")

        // Then
        #expect(throws: StateError.reserved("keys")) {
            try sut.write(folder: nil, key: "keys", text: "{}")
        }
        #expect(try sut.read(folder: nil, key: "keys") == "[]")
        #expect(try sut.read(folder: "host", key: "keys") == "1")
    }

    @Test("all reads none from a state folder that is not there")
    func allReadsNoneWithoutFolder() throws {
        // Given
        // When
        let entries = try sut.all()

        // Then
        #expect(entries.isEmpty)
    }

    @Test("all leaves out what is not a key's file")
    func allLeavesOutOtherFiles() throws {
        // Given
        try sut.write(folder: nil, key: "a", text: "1")
        try Data("2".utf8).write(to: folder.appending(path: "b.json.tmp"))
        try Data("3".utf8).write(to: folder.appending(path: "Upper.json"))
        try FileManager.default.createDirectory(
            at: folder.appending(path: "host/deeper"),
            withIntermediateDirectories: true
        )
        try Data("4".utf8).write(to: folder.appending(path: "host/deeper/c.json"))

        // When
        let entries = try sut.all()

        // Then
        #expect(entries == [StateEntry(folder: nil, key: "a", text: "1")])
    }

    @Test("a key that would not name a file is refused as KEY", arguments: ["", "Order", "a/b", "a..b", ".a"])
    func badKeyIsRefused(key: String) {
        // Given
        // When
        // Then
        #expect(throws: StateError.notAKey(key)) {
            try sut.write(folder: nil, key: key, text: "1")
        }
    }

    @Test("a folder that would not name one is refused as FOLDER", arguments: ["", "Host", "a/b", ".."])
    func badFolderIsRefused(folder: String) {
        // Given
        // When
        // Then
        #expect(throws: StateError.notAFolder(folder)) {
            try sut.write(folder: folder, key: "a", text: "1")
        }
    }
}
