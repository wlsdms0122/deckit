//
//  ManifestReaderTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("ManifestReader")
struct ManifestReaderTests {
    // MARK: - Property
    private let mods = Permission(id: "deckit.mods", name: "Mods", means: "Every mod.", reach: .app)
    private let network = Permission(id: "system.network", name: "Network", means: "The web.", reach: .system)
    private let sut: ManifestReader

    // MARK: - Initializer
    init() throws {
        sut = try ManifestReader(
            api: try #require(Version("1.2.0")),
            permissions: [mods, network],
            fields: [],
            store: Store()
        )
    }

    // MARK: - Test
    @Test("a manifest is read with the permissions it asks for, the widest first, and why")
    func testThatManifestIsRead() throws {
        // Given
        let text = """
            id = "notes"
            name = "Notes"
            version = "1.0.0"
            api = "1.1.0"
            main = "dist/main.js"
            [requires]
            files = "1.0.0"
            [permissions]
            "deckit.mods" = " to list them "
            "system.network" = "to sync"
            """

        // When
        let manifest = sut.read(text, fallback: "folder")

        // Then
        #expect(sut.problem(of: text) == nil)
        #expect(manifest.id == "notes")
        #expect(manifest.requires == ["files": "1.0.0"])
        #expect(
            manifest.permissions == [
                PermissionRequest(permission: network, reason: "to sync"),
                PermissionRequest(permission: mods, reason: "to list them")
            ]
        )
    }

    @Test("a manifest that is no manifest is read by the folder's name, and says why")
    func testThatBrokenManifestIsReadByFallback() {
        // Given
        let text = "id = "

        // When
        let manifest = sut.read(text, fallback: "folder")

        // Then
        #expect(manifest.id == "folder")
        #expect(manifest.name == "folder")
        #expect(sut.problem(of: text) == "manifest.toml: line 1: not a value this reads: ")
    }

    @Test(
        "what is wrong with a manifest is said",
        arguments: [
            ("color = 1", #"manifest.toml has "color", which is not a manifest field"#),
            ("name = 1", #"manifest.toml needs an id, as id = "my-mod""#),
            (#"id = "Notes""#, #"mod ids are lower case: "notes", not "Notes""#),
            (#"id = "a""#, #"manifest.toml needs a version, as version = "1.0.0""#),
            (#"id = "a"\#nversion = 1"#, #"version must be written as "MAJOR.MINOR.PATCH", not 1"#),
            (#"id = "a"\#nversion = "1.0.0"\#napi = "2.0.0""#, "needs api 2.0.0, this deck speaks 1.2.0"),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "../x.js""#,
                #"main must be a path inside the mod's folder, as main = "dist/main.js", not "../x.js""#
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[optional]\#na = "1.0.0""#,
                "a names itself in [optional]"
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[permissions]\#nx = "y""#,
                #"unknown permission "x"; there are "system.network", "deckit.mods""#
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[permissions]\#n"deckit.mods" = " ""#,
                #"permission "deckit.mods" needs the reason it is asked for, as text"#
            )
        ]
    )
    func testThatProblemIsSaid(text: String, problem: String) {
        // Given
        // When
        let said = sut.problem(of: text)

        // Then
        #expect(said == problem)
    }

    @Test("a permission or a field defined twice is refused")
    func testThatDefinitionTwiceIsRefused() throws {
        // Given
        let api = try #require(Version("1.0.0"))

        // When
        // Then
        #expect(throws: ManifestError.permissionDefined("deckit.mods")) {
            try ManifestReader(api: api, permissions: [mods, mods], fields: [], store: Store())
        }
        #expect(throws: ManifestError.fieldDefined("main")) {
            try ManifestReader(api: api, permissions: [], fields: [MainField()], store: Store())
        }
    }
}

private struct MainField: ManifestField {
    let name = "main"
    let key = "main"

    func read(_ written: TOMLValue?) -> any Encodable & Sendable {
        ""
    }

    func problem(of written: TOMLValue) -> String? {
        nil
    }
}
