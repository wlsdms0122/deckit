//
//  ModStorageTests.swift
//  DeckTests
//
//  Created by JSilver on 10/21/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("ModStorage")
struct ModStorageTests {
    // MARK: - Property
    private let home: URL
    private let record: Record
    private let sut: ModStorage

    // MARK: - Initializer
    init() throws {
        home = FileManager.default.temporaryDirectory.appending(path: "storage-tests-\(UUID().uuidString)")
        let store = Store()
        record = Record(folder: home.appending(path: "records"), store: store)
        let reader = try ManifestReader(api: try #require(Version("1.0.0")), permissions: [], fields: [], store: store)
        let modFolder = ModFolder(reader: reader, store: store)
        let folder = home.appending(path: "mods")
        let dataFolder = DataFolder(folder: home.appending(path: "data"), store: store)
        let catalog = Catalog(
            folder: folder,
            sources: [],
            ship: [],
            modFolder: modFolder,
            dataFolder: dataFolder,
            installer: Installer(home: home, folder: folder, ship: [], modFolder: modFolder, store: store),
            store: store
        )
        sut = ModStorage(
            dataFolder: dataFolder,
            record: record,
            setting: Setting(
                folder: home.appending(path: "settings"),
                store: store,
                catalog: catalog,
                runner: Runner(catalog: catalog)
            ),
            store: store
        )
    }

    // MARK: - Test
    @Test("usage tells what the mod has in each place deck keeps it, and nothing of another mod's")
    func usageTellsEachPlace() throws {
        // Given
        let data = home.appending(path: "data/notes/inner")
        try FileManager.default.createDirectory(at: data, withIntermediateDirectories: true)
        try Data().write(to: data.appending(path: "a"))
        try record.write(mod: "notes", key: "tabs", text: "[]")
        try record.write(mod: "notes", key: "panes", text: "[]")
        let settings = home.appending(path: "settings")
        try FileManager.default.createDirectory(at: settings, withIntermediateDirectories: true)
        try Data("{}".utf8).write(to: settings.appending(path: "notes.json"))

        // When
        let usage = try sut.usage(mod: "notes")
        let other = try sut.usage(mod: "finder")

        // Then
        #expect(
            usage == StorageUsage(
                data: DataCount(count: 1, capped: false, hidden: false),
                records: RecordCount(count: 2, hidden: false),
                settings: true
            )
        )
        #expect(
            other == StorageUsage(
                data: DataCount(count: 0, capped: false, hidden: false),
                records: RecordCount(count: 0, hidden: false),
                settings: false
            )
        )
    }

    @Test("usage is refused for an id that is no mod's", arguments: ["../notes", "Notes"])
    func usageRefusesOtherIds(mod: String) {
        // Given
        // When
        let usage = Result { try sut.usage(mod: mod) }

        // Then
        #expect(throws: ModStorageError.notAMod(mod)) { try usage.get() }
    }
}
