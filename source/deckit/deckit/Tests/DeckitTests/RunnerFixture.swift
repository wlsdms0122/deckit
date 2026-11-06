//
//  RunnerFixture.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

// The mods a test writes into a source folder, and a catalog over them.
struct RunnerFixture {
    // MARK: - Property
    private let home: URL
    private let source: URL

    // MARK: - Initializer
    init(_ name: String) {
        let root = FileManager.default.temporaryDirectory.appending(path: "\(name)-\(UUID().uuidString)")
        home = root.appending(path: "home")
        source = root.appending(path: "source")
    }

    // MARK: - Public
    // A mod that provides each interface in `provides` at the majors given and uses each in `uses` at the major given.
    func write(
        _ id: String,
        version: String = "1.0.0",
        provides: [String: [Int]] = [:],
        uses: [String: Int] = [:]
    ) throws {
        let location = source.appending(path: id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let provided = provides.sorted { one, other in one.key < other.key }.map { interface, majors in
            "\"\(interface)\" = [" + majors.map(String.init).joined(separator: ", ") + "]"
        }
        let used = uses.sorted { one, other in one.key < other.key }.map { interface, major in
            "\"\(interface)\" = \(major)"
        }
        let text = """
            id = "\(id)"
            version = "\(version)"
            api = "1.0.0"
            main = "main.js"
            """
            + (provided.isEmpty && used.isEmpty ? "" : "\n[interfaces]")
            + (provided.isEmpty ? "" : "\nprovides = { " + provided.joined(separator: ", ") + " }")
            + (used.isEmpty ? "" : "\nuses = { " + used.joined(separator: ", ") + " }")
        try Data(text.utf8).write(to: location.appending(path: "manifest.toml"))
        try Data().write(to: location.appending(path: "main.js"))
    }

    // `deck.json` as `text`.
    func writeSettings(_ text: String) throws {
        try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
        try Data(text.utf8).write(to: home.appending(path: "deck.json"))
    }

    func remove(_ id: String) throws {
        try FileManager.default.removeItem(at: source.appending(path: id))
    }

    // A catalog over what is written, read.
    func catalog() throws -> Catalog {
        let store = Store()
        let reader = try ManifestReader(
            api: try #require(Version("1.0.0")),
            permissions: [],
            fields: [],
            store: store
        )
        let modFolder = ModFolder(reader: reader, store: store)
        let folder = home.appending(path: "mods")
        let settings = home.appending(path: "deck.json")
        let catalog = Catalog(
            folder: folder,
            sources: [source],
            ship: [],
            modFolder: modFolder,
            dataFolder: DataFolder(folder: home.appending(path: "data"), store: store),
            installer: Installer(home: home, folder: folder, ship: [], modFolder: modFolder, store: store),
            ownerTable: Deck(home: home).owners,
            startupList: StartupList(file: settings, store: store),
            store: store
        )
        _ = catalog.read()

        return catalog
    }

    // MARK: - Private
}
