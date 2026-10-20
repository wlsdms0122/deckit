//
//  ModHome.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

// Deckit's folder and a folder of mods read in place, as a test writes them.
struct ModHome {
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
    func write(_ id: String, permissions: [String] = [], urlSchemes: [String] = []) throws {
        let location = source.appending(path: id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let asked = permissions.isEmpty
            ? ""
            : "\n[permissions]\n" + permissions.map { permission in "\"\(permission)\" = \"to test\"" }
                .joined(separator: "\n")
        let schemes = urlSchemes.isEmpty
            ? ""
            : "\nurl-schemes = [" + urlSchemes.map { scheme in "\"\(scheme)\"" }.joined(separator: ", ") + "]"
        let text = """
            id = "\(id)"
            name = "\(id.uppercased())"
            version = "1.0.0"
            api = "1.0.0"
            main = "main.js"
            """ + schemes + asked
        try Data(text.utf8).write(to: location.appending(path: "manifest.toml"))
        try Data().write(to: location.appending(path: "main.js"))
    }

    // A deckit over what is written, the app named App asking `schemeHandlers` first, its mods read and each that loads
    // launching.
    func deckit(schemeHandlers: [String: [String]] = [:]) throws -> Deckit {
        let sut = try Deckit(
            home: home,
            ship: [],
            sources: [source],
            api: try #require(Version("1.0.0")),
            name: "App",
            schemeHandlers: schemeHandlers,
            permissions: []
        )
        _ = try sut.json("catalog/read")
        _ = try sut.json("runner/reconcile")

        return sut
    }

    // MARK: - Private
}
