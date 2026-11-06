//
//  DeckitFixture.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

// The mods a test writes into a source folder, and a deckit over them.
struct DeckitFixture {
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
    // `provides` are the interfaces it provides at major 1, and `contributes` the TOML of what it declares to
    // interfaces, written after its other fields.
    func write(
        _ id: String,
        api: String = "1.0.0",
        permissions: [String] = [],
        provides: [String] = [],
        contributes: String = ""
    ) throws {
        let location = source.appending(path: id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let asked = permissions.isEmpty
            ? ""
            : "\n[permissions]\n" + permissions.map { permission in "\"\(permission)\" = \"to test\"" }
                .joined(separator: "\n")
        let provided = provides.isEmpty
            ? ""
            : "\n[interfaces]\nprovides = { " + provides.map { interface in "\"\(interface)\" = [1]" }
                .joined(separator: ", ") + " }"
        let text = """
            id = "\(id)"
            name = "\(id.uppercased())"
            version = "1.0.0"
            api = "\(api)"
            main = "main.js"
            """ + asked + provided + (contributes.isEmpty ? "" : "\n" + contributes)
        try Data(text.utf8).write(to: location.appending(path: "manifest.toml"))
        try Data().write(to: location.appending(path: "main.js"))
    }

    func remove(_ id: String) throws {
        try FileManager.default.removeItem(at: source.appending(path: id))
    }

    // A deckit over what is written, its mods read and each that loads launching.
    func deckit() throws -> Deckit {
        let sut = try Deckit(
            home: home,
            ship: [],
            sources: [source],
            api: try #require(Version("1.0.0")),
            permissions: []
        )
        let mods = sut.readCatalog()
        _ = try sut.load(mods.map { mod in LaunchRequest(modId: mod.manifest.id) })

        return sut
    }

    // MARK: - Private
}
