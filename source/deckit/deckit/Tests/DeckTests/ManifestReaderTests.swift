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
    private let mods = Permission(id: "deckit.mods", name: "Mods", means: "Every mod.")
    private let network = Permission(id: "system.network", name: "Network", means: "The web.")
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
    @Test("a manifest is read with its permissions, why, and what a layer here defines each as, the widest first")
    func manifestIsRead() throws {
        // Given
        let text = """
            id = "notes"
            name = "Notes"
            version = "1.0.0"
            api = "1.1.0"
            main = "dist/main.js"
            [implements]
            "notes/pages" = "2.1.0"
            "files/open" = "1.0.0"
            [dependencies]
            "files/store" = "1.0.0"
            "notes/pages" = { version = "1.2.0", optional = true }
            [permissions]
            "deckit.mods" = " to list them "
            "system.network" = "to sync"
            "system.camera" = "to see"
            """

        // When
        let manifest = sut.read(text, fallback: "folder")

        // Then
        #expect(sut.problem(of: text) == nil)
        #expect(manifest.id == "notes")
        #expect(manifest.implements == ["notes/pages": "2.1.0", "files/open": "1.0.0"])
        #expect(
            manifest.dependencies == [
                "files/store": Dependency(version: "1.0.0", optional: false),
                "notes/pages": Dependency(version: "1.2.0", optional: true)
            ]
        )
        #expect(manifest.required == ["files/store"])
        #expect(
            manifest.permissions == [
                PermissionRequest(id: network.id, reason: "to sync", permission: network),
                PermissionRequest(id: "system.camera", reason: "to see", permission: nil),
                PermissionRequest(id: mods.id, reason: "to list them", permission: mods)
            ]
        )
    }

    @Test("a manifest that is no manifest is read by the folder's name, and says why")
    func brokenManifestIsReadByFallback() {
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
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[dependencies]\#nb = "1.0.0""#,
                #"dependencies b: "b" is not an interface: <mod id>/<name>, each lower case letters, digits, . _ - and at most 64 of them"#
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[dependencies]\#n"b/c/d" = "1.0.0""#,
                #"dependencies b/c/d: "b/c/d" is not an interface: <mod id>/<name>, each lower case letters, digits, . _ - and at most 64 of them"#
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[implements]\#n"B/c" = "1.0.0""#,
                #"implements B/c: "B/c" is not an interface: <mod id>/<name>, each lower case letters, digits, . _ - and at most 64 of them"#
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[implements]\#n"a/c" = "1.0""#,
                #"implements a/c must be written as "MAJOR.MINOR.PATCH", not "1.0""#
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#nimplements = "a/c""#,
                #"implements must be an [implements] table of interface = version, as "other/name" = "1.0.0""#
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[implements]\#n"b/c" = "1.0.0"\#n[dependencies]\#n"b/c" = "1.0.0""#,
                "a requires b/c, which it implements: it may name it as optional"
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[implements]\#n"b/c" = "1.0.0"\#n[dependencies]\#n"b/c" = { version = "1.0.0" }"#,
                "a requires b/c, which it implements: it may name it as optional"
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[dependencies]\#n"b/c" = { optional = true }"#,
                #"dependencies b/c needs a version written as "MAJOR.MINOR.PATCH", as "other/name" = "1.0.0", or "other/name" = { version = "1.0.0", optional = true }"#
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[dependencies]\#n"b/c" = { version = "1.0.0", optional = 1 }"#,
                "dependencies b/c: optional must be true or false"
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[dependencies]\#n"b/c" = { version = "1.0.0", lazy = true }"#,
                #"dependencies b/c has "lazy"; it takes version and optional"#
            ),
            (
                #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n[permissions]\#n"deckit.mods" = " ""#,
                #"permission "deckit.mods" needs the reason it is asked for, as text"#
            )
        ]
    )
    func problemIsSaid(text: String, problem: String) {
        // Given
        // When
        let said = sut.problem(of: text)

        // Then
        #expect(said == problem)
    }

    @Test("a permission or a field defined twice is refused")
    func definitionTwiceIsRefused() throws {
        // Given
        let api = try #require(Version("1.0.0"))

        // When
        let permissionTwice = Result {
            try ManifestReader(api: api, permissions: [mods, mods], fields: [], store: Store())
        }
        let fieldTwice = Result {
            try ManifestReader(api: api, permissions: [], fields: [MainField()], store: Store())
        }

        // Then
        #expect(throws: ManifestError.permissionDefined("deckit.mods")) { try permissionTwice.get() }
        #expect(throws: ManifestError.fieldDefined("main")) { try fieldTwice.get() }
    }
}

private struct MainField: ManifestField {
    let name = "main"
    let key = "main"

    func read(_ written: TOMLValue?) -> String {
        ""
    }

    func problem(of written: TOMLValue) -> String? {
        nil
    }
}
