//
//  PrincipalStorageTests.swift
//  DeckTests
//
//  Created by JSilver on 10/21/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("PrincipalStorage")
struct PrincipalStorageTests {
    // MARK: - Property
    private let home: URL
    private let record: Record
    private let principalState: PrincipalState
    private let keys: AuthorizedKeyStore
    private let sut: PrincipalStorage

    // MARK: - Initializer
    init() throws {
        home = FileManager.default.temporaryDirectory.appending(path: "storage-tests-\(UUID().uuidString)")
        let store = Store()
        record = Record(folder: home.appending(path: "records"), store: store)
        principalState = PrincipalState(root: home.appending(path: "principal-state"), store: store)
        try principalState.reserve("layer")
        try principalState.reserve("other-layer")
        keys = AuthorizedKeyStore(folder: home.appending(path: "authorized-keys"), store: store)
        sut = PrincipalStorage(
            dataFolder: DataFolder(folder: home.appending(path: "data"), store: store),
            record: record,
            principalState: principalState,
            keys: keys,
            store: store
        )
    }

    // MARK: - Test
    @Test("usage tells what the principal has in each place deck keeps it, and nothing of another principal's")
    func usageTellsEachPlace() throws {
        // Given
        let data = home.appending(path: "data/notes/inner")
        try FileManager.default.createDirectory(at: data, withIntermediateDirectories: true)
        try Data().write(to: data.appending(path: "a"))
        try record.write(principal: "notes", key: "tabs", text: "[]")
        try record.write(principal: "notes", key: "panes", text: "[]")
        try principalState.write("other-layer", principal: "notes", text: "{}")
        try keys.authorize(
            principal: "notes",
            key: AuthorizedKey(scheme: .ed25519, key: Data(repeating: 1, count: 32), name: "test")
        )

        // When
        let usage = try sut.usage(principal: "notes")
        let other = try sut.usage(principal: "other")

        // Then
        #expect(
            usage == StorageUsage(
                data: DataCount(count: 1, capped: false, hidden: false),
                records: RecordCount(count: 2, hidden: false),
                kept: ["other-layer"],
                keys: 1
            )
        )
        #expect(
            other == StorageUsage(
                data: DataCount(count: 0, capped: false, hidden: false),
                records: RecordCount(count: 0, hidden: false),
                kept: [],
                keys: 0
            )
        )
    }

    @Test("usage is refused for an id that is no principal's", arguments: ["../notes", "Notes"])
    func usageRefusesOtherIds(principal: String) {
        // Given
        // When
        let usage = Result { try sut.usage(principal: principal) }

        // Then
        #expect(throws: PrincipalStorageError.notAPrincipal(principal)) { try usage.get() }
    }
}
