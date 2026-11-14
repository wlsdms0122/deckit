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

// The mods a test writes into a source folder, a spare one to install from, or the app's as system mods, and a deckit
// over them.
struct DeckitFixture {
    // MARK: - Property
    private let home: URL
    private let source: URL
    private let spare: URL
    private let ship: URL

    // MARK: - Initializer
    init(_ name: String) {
        let root = FileManager.default.temporaryDirectory.appending(path: "\(name)-\(UUID().uuidString)")
        home = root.appending(path: "home")
        source = root.appending(path: "source")
        spare = root.appending(path: "spare")
        ship = root.appending(path: "ship")
    }

    // MARK: - Public
    // `provides` and `uses` are the interfaces it provides and uses at major 1, `background` why it runs in the
    // background, and `contributes` the TOML of what it declares to interfaces, written after its other fields. A
    // `spare` mod is not read until it is installed from `folder(of:)`, and a `system` one is shipped by the app as a
    // system mod.
    func write(
        _ id: String,
        spare: Bool = false,
        system: Bool = false,
        api: String = "1.0.0",
        background: String? = nil,
        permissions: [String] = [],
        provides: [String] = [],
        uses: [String] = [],
        contributes: String = ""
    ) throws {
        let location = spare ? folder(of: id) : (system ? ship : source).appending(path: id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let asked = permissions.isEmpty
            ? ""
            : "\n[permissions]\n" + permissions.map { permission in "\"\(permission)\" = \"to test\"" }
                .joined(separator: "\n")
        let provided = provides.isEmpty
            ? ""
            : "\nprovides = { " + provides.map { interface in "\"\(interface)\" = [1]" }.joined(separator: ", ") + " }"
        let used = uses.isEmpty
            ? ""
            : "\nuses = { " + uses.map { interface in "\"\(interface)\" = 1" }.joined(separator: ", ") + " }"
        let interfaces = provided.isEmpty && used.isEmpty ? "" : "\n[interfaces]" + provided + used
        let text = """
            id = "\(id)"
            name = "\(id.uppercased())"
            version = "1.0.0"
            api = "\(api)"
            main = "main.js"
            """ + (background.map { reason in "\nbackground = \"\(reason)\"" } ?? "") + asked + interfaces
            + (contributes.isEmpty ? "" : "\n" + contributes)
        try Data(text.utf8).write(to: location.appending(path: "manifest.toml"))
        try Data().write(to: location.appending(path: "main.js"))
    }

    // The folder a spare mod is written in.
    func folder(of id: String) -> URL {
        spare.appending(path: id)
    }

    func remove(_ id: String) throws {
        try FileManager.default.removeItem(at: source.appending(path: id))
    }

    // A deckit over what is written, what the app ships installed and its mods read, which defines `permissions` and
    // whose mods reach the relaunch limit as `limit` says, their runs failing at `now`.
    func deckit(
        permissions: [Permission] = [],
        limit: RelaunchLimit = RelaunchLimit(burst: 5, interval: 10),
        now: @escaping () -> Date = Date.init
    ) throws -> Deckit {
        let shipped = ((try? FileManager.default.contentsOfDirectory(atPath: ship.path(percentEncoded: false))) ?? [])
            .sorted()
            .map { id in ShippedMod(folder: ship.appending(path: id), system: true) }
        let sut = try Deckit(
            home: home,
            ship: shipped,
            sources: [source],
            api: try #require(Version("1.0.0")),
            permissions: permissions,
            limit: limit,
            now: now
        )
        _ = try sut.catalog.installShipped()
        _ = sut.readCatalog()

        return sut
    }

    // MARK: - Private
}
