//
//  CatalogTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("Catalog")
struct CatalogTests {
    // MARK: - Property
    private let root: URL
    private let home: URL
    private let source: URL
    private let ship: URL
    private let state: State

    // MARK: - Initializer
    init() {
        root = FileManager.default.temporaryDirectory.appending(path: "catalog-tests-\(UUID().uuidString)")
        home = root.appending(path: "home")
        source = root.appending(path: "source")
        ship = root.appending(path: "ship")
        state = State(root: home.appending(path: "state"), store: Store())
    }

    // MARK: - Test
    @Test("those that load come in the person's order, then as the app ships them, then by id; then the rest")
    func modsComeInOrder() throws {
        // Given
        try write("c", in: home.appending(path: "mods"))
        try write("b", in: home.appending(path: "mods"))
        try write("a", in: home.appending(path: "mods"))
        try write("d", in: home.appending(path: "mods"), main: nil)
        try write("e", in: ship)
        try state.write(folder: nil, key: "mod-order", text: #"["c"]"#)
        let sut = try catalog(ship: [ship.appending(path: "e")])
        _ = try sut.installShipped()

        // When
        let mods = sut.mods()

        // Then
        #expect(mods.map(\.manifest.id) == ["c", "e", "a", "b", "d"])
        #expect(mods.last?.problem == #"main = "missing.js" names no file in the mod's folder"#)
    }

    @Test("a mod read in place comes before an installed copy of its id, which it hides")
    func sourceHidesInstalled() throws {
        // Given
        try write("a", in: source)
        try write("a", in: home.appending(path: "mods"))
        let sut = try catalog(sources: [source])

        // When
        let mods = sut.mods()

        // Then
        #expect(mods.count == 1)
        #expect(mods.first?.installed == false)
        #expect(mods.first?.hides.map(\.lastPathComponent) == ["a"])
        #expect(throws: InstallError.self) { try sut.remove("a") }
    }

    @Test("a cycle fails every mod in it, and a failure spreads to whoever requires it")
    func requirementsFail() throws {
        // Given
        try write("a", in: source, requires: ["b": "1.0.0"])
        try write("b", in: source, requires: ["a": "1.0.0"])
        try write("c", in: source, requires: ["a": "1.0.0"])
        try write("d", in: source, requires: ["e": "2.0.0"])
        try write("e", in: source)
        let sut = try catalog(sources: [source])

        // When
        let problems = Dictionary(uniqueKeysWithValues: sut.mods().map { mod in (mod.manifest.id, mod.problem) })

        // Then
        #expect(problems["a"] == "requires itself: a → b → a")
        #expect(problems["b"] == "requires itself: a → b → a")
        #expect(problems["c"] == "needs a, which did not load")
        #expect(problems["d"] == "needs e 2.0.0, and e is 1.0.0")
        #expect(problems["e"] == .some(nil))
    }

    @Test("arranging moves the ids named among the places they held, and keeps the order in the state")
    func arrangeKeepsOrder() throws {
        // Given
        for id in ["a", "b", "c", "d"] {
            try write(id, in: source)
        }
        let sut = try catalog(sources: [source])

        // When
        try sut.arrange(["d", "b", "x", "d"])

        // Then
        #expect(sut.mods().map(\.manifest.id) == ["a", "d", "c", "b"])
        #expect(try state.read(folder: nil, key: "mod-order") == #"["a","d","c","b"]"#)
    }

    @Test("installing copies the folder as mods/<id>, takes every copy before it away, and changes the revision")
    func installReplacesCopies() throws {
        // Given
        try write("a", in: home.appending(path: "mods"), folder: "old-a")
        try write("a", in: source, version: "2.0.0")
        let sut = try catalog()
        let before = try #require(sut.mods().first)

        // When
        let manifest = try sut.install(from: source.appending(path: "a"))

        // Then
        let after = try #require(sut.mods().first)
        #expect(manifest.version == "2.0.0")
        #expect(after.folder.lastPathComponent == "a")
        #expect(after.manifest.version == "2.0.0")
        #expect(after.revision != before.revision)
        #expect(!FileManager.default.fileExists(atPath: home.appending(path: "mods/old-a").path(percentEncoded: false)))
        let staging = home.appending(path: ".mods-installing")
        #expect(!FileManager.default.fileExists(atPath: staging.path(percentEncoded: false)))
    }

    @Test("a folder that does not load, the installed one, or one a source hides is not installed")
    func installRefuses() throws {
        // Given
        try write("a", in: home.appending(path: "mods"))
        try write("b", in: root, main: nil)
        try write("c", in: source)
        try write("c", in: root.appending(path: "other"))
        let sut = try catalog(sources: [source])

        // When
        // Then
        #expect(throws: InstallError.installedThere) {
            try sut.wouldInstall(from: home.appending(path: "mods/a"))
        }
        #expect(throws: InstallError.notLoadable(#"main = "missing.js" names no file in the mod's folder"#)) {
            try sut.wouldInstall(from: root.appending(path: "b"))
        }
        let shadow = "c is read from \(source.appending(path: "c").path(percentEncoded: false)), which would hide the "
            + "installed copy"
        #expect(throws: InstallError.refused(shadow)) {
            try sut.wouldInstall(from: root.appending(path: "other/c"))
        }
    }

    @Test("what the app ships is installed, but not again once the person removed it")
    func shippedRemovedStaysOut() throws {
        // Given
        try write("a", in: ship)
        try write("b", in: ship, main: nil)
        let shipped = [ship.appending(path: "a"), ship.appending(path: "b")]
        let first = try catalog(ship: shipped)
        let outcomes = try first.installShipped()
        _ = try first.remove("a")

        // When
        let again = try catalog(ship: shipped).installShipped()

        // Then
        #expect(outcomes.map(\.outcome) == [.installed, .failed])
        #expect(again.map(\.outcome) == [.leftOut, .failed])
        let failed = try catalog(ship: shipped)
        _ = try failed.installShipped()
        let problem = #"did not install: main = "missing.js" names no file in the mod's folder"#
        #expect(failed.mods().map(\.problem) == [problem])
        try write("b", in: source)
        #expect(try failed.wouldInstall(from: source.appending(path: "b")).id == "b")
        #expect(throws: InstallError.notInstalled("b")) { try failed.remove("b") }
    }

    @Test("removing a mod whose manifest names no mod id answers that deck keeps nothing under it")
    func removeAnswersWhetherIdKeepsData() throws {
        // Given
        try write("Note", in: home.appending(path: "mods"))
        try write("note", in: home.appending(path: "mods"), folder: "note-copy")
        let sut = try catalog()

        // When
        let other = try sut.remove("Note")
        let own = try sut.remove("note")

        // Then
        #expect(other == false)
        #expect(own == true)
    }

    // MARK: - Private
    private func catalog(sources: [URL] = [], ship: [URL] = []) throws -> Catalog {
        let store = Store()
        let reader = try ManifestReader(api: try #require(Version("1.0.0")), permissions: [], fields: [], store: store)
        let modFolder = ModFolder(reader: reader, store: store)
        let folder = home.appending(path: "mods")
        return Catalog(
            folder: folder,
            sources: sources,
            ship: ship,
            modFolder: modFolder,
            installer: Installer(home: home, folder: folder, ship: ship, modFolder: modFolder, store: store),
            state: state,
            store: store
        )
    }

    private func write(
        _ id: String,
        in parent: URL,
        folder: String? = nil,
        version: String = "1.0.0",
        main: String? = "main.js",
        requires: [String: String] = [:]
    ) throws {
        let location = parent.appending(path: folder ?? id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let dependencies = requires.isEmpty
            ? ""
            : "\n[requires]\n" + requires.map { other, want in "\(other) = \"\(want)\"" }.joined(separator: "\n")
        let text = """
            id = "\(id)"
            version = "\(version)"
            api = "1.0.0"
            main = "\(main ?? "missing.js")"
            """ + dependencies
        try Data(text.utf8).write(to: location.appending(path: "manifest.toml"))
        if let main {
            try Data().write(to: location.appending(path: main))
        }
    }
}
