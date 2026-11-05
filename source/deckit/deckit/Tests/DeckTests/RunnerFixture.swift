//
//  RunnerFixture.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

// The mods a test writes into a source folder, and a runner or a deck over them.
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
    // A mod that provides each interface in `provides` at the majors given, uses each in `uses` at the major given,
    // and depends on the mods in `requires` and `optional`, by id, at the version given.
    func write(
        _ id: String,
        version: String = "1.0.0",
        provides: [String: [Int]] = [:],
        uses: [String: Int] = [:],
        requires: [String: String] = [:],
        optional: [String: String] = [:]
    ) throws {
        let location = source.appending(path: id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let provided = provides.sorted { one, other in one.key < other.key }.map { interface, majors in
            "\"\(interface)\" = [" + majors.map(String.init).joined(separator: ", ") + "]"
        }
        let used = uses.sorted { one, other in one.key < other.key }.map { interface, major in
            "\"\(interface)\" = \(major)"
        }
        let dependencies = requires.map { other, want in "\(other) = \"\(want)\"" }
            + optional.map { other, want in "\(other) = { version = \"\(want)\", optional = true }" }
        let text = """
            id = "\(id)"
            version = "\(version)"
            api = "1.0.0"
            main = "main.js"
            """
            + (provided.isEmpty && used.isEmpty ? "" : "\n[interfaces]")
            + (provided.isEmpty ? "" : "\nprovides = { " + provided.joined(separator: ", ") + " }")
            + (used.isEmpty ? "" : "\nuses = { " + used.joined(separator: ", ") + " }")
            + (dependencies.isEmpty ? "" : "\n[dependencies]\n" + dependencies.joined(separator: "\n"))
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

    // A runner over what is written, as the catalog reads it, with no mod loaded.
    func runner() throws -> Runner {
        Runner(catalog: try catalog())
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
            order: Order(file: settings, store: store),
            ownershipStore: OwnershipStore(file: settings, store: store),
            store: store
        )
        _ = catalog.read()

        return catalog
    }

    // A deck over what is written, its catalog read, with no mod loaded.
    func deck() throws -> Deck {
        let deck = try Deck(
            home: home,
            ship: [],
            sources: [source],
            api: try #require(Version("1.0.0")),
            permissions: [],
            fields: []
        )
        _ = deck.readCatalog()

        return deck
    }

    // MARK: - Private
}
