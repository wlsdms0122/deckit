//
//  HostTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
import Deck
import Deckit

// A Swift host, which reaches deckit only through what Deck and Deckit make public.
@Suite("Host")
struct HostTests {
    // MARK: - Property
    private let root = FileManager.default.temporaryDirectory.appending(path: "host-tests-\(UUID().uuidString)")

    // MARK: - Initializer
    // MARK: - Test
    @Test("a host builds a deckit, reads its mods and launches one, with no JSON")
    func hostLaunchesAMod() throws {
        // Given
        try writeMod("a")
        let sut = try deckit()

        // When
        let mods = sut.readCatalog()
        let effects = try sut.load(mods.map(\.manifest.id))

        // Then
        #expect(mods.map(\.manifest.name) == ["A"])
        #expect(effects.contains { effect in
            guard case let .open(job) = effect else { return false }
            return job.principal == "a"
        })
    }

    @Test("a part kept after the deckit it came from is let go still works")
    func partOutlivesItsDeckit() throws {
        // Given
        let sut = try deckit().state

        // When
        try sut.write(folder: nil, key: "kept", text: "1")

        // Then
        #expect(try sut.read(folder: nil, key: "kept") == "1")
    }

    // MARK: - Private
    private func deckit() throws -> Deckit {
        try Deckit(
            home: root.appending(path: "home"),
            ship: [],
            sources: [root.appending(path: "source")],
            api: try #require(Version("1.0.0")),
            permissions: []
        )
    }

    private func writeMod(_ id: String) throws {
        let folder = root.appending(path: "source").appending(path: id)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let manifest = """
            id = "\(id)"
            name = "\(id.uppercased())"
            version = "1.0.0"
            api = "1.0.0"
            main = "main.js"
            """
        try Data(manifest.utf8).write(to: folder.appending(path: "manifest.toml"))
        try Data().write(to: folder.appending(path: "main.js"))
    }
}
