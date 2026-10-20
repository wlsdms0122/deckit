//
//  ModSource.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

// A folder of mods read in place, written for a test, and the runner that runs what of them loads.
struct ModSource {
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
    func write(
        _ id: String,
        version: String = "1.0.0",
        requires: [String: String] = [:],
        optional: [String: String] = [:]
    ) throws {
        let location = source.appending(path: id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let section = { (name: String, wants: [String: String]) in
            wants.isEmpty
                ? ""
                : "\n[\(name)]\n" + wants.map { other, want in "\(other) = \"\(want)\"" }.joined(separator: "\n")
        }
        let text = """
            id = "\(id)"
            version = "\(version)"
            api = "1.0.0"
            main = "main.js"
            """ + section("requires", requires) + section("optional", optional)
        try Data(text.utf8).write(to: location.appending(path: "manifest.toml"))
        try Data().write(to: location.appending(path: "main.js"))
    }

    // A runner over what is written, each mod that loads opened and launching.
    func runner() throws -> Runner {
        let store = Store()
        let reader = try ManifestReader(api: try #require(Version("1.0.0")), permissions: [], fields: [], store: store)
        let modFolder = ModFolder(reader: reader, store: store)
        let folder = home.appending(path: "mods")
        let catalog = Catalog(
            folder: folder,
            sources: [source],
            ship: [],
            modFolder: modFolder,
            installer: Installer(home: home, folder: folder, ship: [], modFolder: modFolder, store: store),
            state: State(root: home.appending(path: "state"), store: store),
            store: store
        )
        _ = catalog.read()
        let runner = Runner(catalog: catalog)
        _ = try runner.reconcile()

        return runner
    }

    // MARK: - Private
}
