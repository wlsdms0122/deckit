//
//  RunnerFixture.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

// The mods a test writes into a source folder, and a runner over them.
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
    // A mod that implements each interface in `implements` at the version given, and depends on those in `requires`
    // and `optional` at the version given.
    func write(
        _ id: String,
        version: String = "1.0.0",
        implements: [String: String] = [:],
        requires: [String: String] = [:],
        optional: [String: String] = [:]
    ) throws {
        let location = source.appending(path: id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let implemented = implements.map { interface, version in "\"\(interface)\" = \"\(version)\"" }
        let dependencies = requires.map { interface, want in "\"\(interface)\" = \"\(want)\"" }
            + optional.map { interface, want in "\"\(interface)\" = { version = \"\(want)\", optional = true }" }
        let text = """
            id = "\(id)"
            version = "\(version)"
            api = "1.0.0"
            main = "main.js"
            """
            + (implemented.isEmpty ? "" : "\n[implements]\n" + implemented.joined(separator: "\n"))
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

    // A catalog over what is written, read, the host app placing `implementations` in each interface's list.
    func catalog(implementations: [String: [String]] = [:]) throws -> Catalog {
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
            loadOrder: LoadOrder(file: settings, store: store),
            implementationOrder: ImplementationOrder(file: settings, store: store),
            implementations: implementations,
            store: store
        )
        _ = catalog.read()

        return catalog
    }

    // MARK: - Private
}
