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
    private let find = JSONValue.object(["name": .string("find"), "label": .string("Find")])
    private let findKey = Key(name: "find", command: "find", args: nil, spec: "mod+f", label: "", scope: .local)

    // MARK: - Initializer
    // MARK: - Test
    @Test("a host builds a deckit, registers a key and reads the keymap, with no JSON")
    func hostRegistersAKey() throws {
        // Given
        let sut = try deckit()

        // When
        try sut.commands.define([find], owner: "@app")
        let keymap = try sut.keymap.register(findKey, owner: "@app")

        // Then
        let find = try #require(keymap.bindings.first)
        #expect(find.binding.id == "@app.find")
        #expect(find.binding.owner.name == "Host")
        #expect(find.binding.keystroke == Keystroke(spec: "mod+f"))
        #expect(find.active)
        #expect(find.issues.isEmpty)
    }

    @Test("a mod's run started with the keys it contributed changes the keymap, which deck carries")
    func runChangesTheKeymap() throws {
        // Given
        try writeMod("notes")
        let sut = try deckit()
        let contributions = Contribution(
            exports: Snapshot(values: "{}", functions: []),
            extensionPoints: [],
            extensions: [:],
            layers: [
                "commands": .array([.object(["name": .string("next"), "label": .string("Next")])]),
                "keys": .array([
                    .object([
                        "name": .string("next"),
                        "command": .string("next"),
                        "key": .string("mod+j"),
                        "label": .string(""),
                        "scope": .string("local")
                    ])
                ])
            ]
        )

        // When
        let effects = try sut.deck.started("notes", run: 1, summary: .object([:]), contributions: contributions)

        // Then
        let changes = effects.compactMap { effect in
            if case let .layer(change) = effect { change as? ResolvedKeymap } else { nil }
        }
        let keymap = try #require(changes.last)
        #expect(keymap.bindings.map(\.binding.id) == ["notes.next"])
        #expect(keymap.bindings.first?.binding.owner.name == "NOTES")
    }

    @Test("a part kept after the deckit it came from is let go still works")
    func partOutlivesItsDeckit() throws {
        // Given
        let sut = try {
            let deckit = try deckit()
            try deckit.commands.define([find], owner: "@app")
            return deckit.keymap
        }()

        // When
        let resolved = try sut.register(findKey, owner: "@app")

        // Then
        #expect(resolved.bindings.map(\.binding.id) == ["@app.find"])
    }

    // MARK: - Private
    // A deckit named Host over the mods written, read and each that loads launching.
    private func deckit() throws -> Deckit {
        let deckit = try Deckit(
            home: root.appending(path: "home"),
            ship: [],
            sources: [root.appending(path: "source")],
            api: try #require(Version("1.0.0")),
            name: "Host",
            schemeHandlers: [:],
            permissions: []
        )
        let mods = deckit.deck.readCatalog()
        _ = try deckit.deck.load(mods.map(\.manifest.id))

        return deckit
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
