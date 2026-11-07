//
//  ManifestReaderTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("ManifestReader")
struct ManifestReaderTests {
    // MARK: - Property
    private static let minimal = #"id = "a"\#nversion = "1.0.0"\#napi = "1.0.0"\#nmain = "m.js"\#n"#
    private static let problems: [(text: String, problem: String)] = [
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
            minimal + #"background = " ""#,
            #"background must be the reason the mod asks to run in the background, as text,"#
                + #" as background = "Shows notifications as they come""#
        ),
        (
            minimal + #"interfaces = 1"#,
            #"interfaces must be an [interfaces] table,"#
                + #" as provides = { "other/name" = [1] } and uses = { "other/name" = 1 }"#
        ),
        (
            minimal + #"[interfaces]\#nimplements = 1"#,
            #"interfaces has "implements"; it takes provides and uses"#
        ),
        (
            minimal + #"[interfaces]\#nprovides = 1"#,
            #"interfaces.provides must be written as provides = { "other/name" = [1] }"#
        ),
        (
            minimal + #"[interfaces]\#nprovides = { "B/c" = [1] }"#,
            #"interfaces.provides B/c: "B/c" is not an interface: <mod id>/<name>, each lower case letters,"#
                + #" digits, . _ - and at most 64 of them"#
        ),
        (
            minimal + #"[interfaces]\#nprovides = { "b" = [1] }"#,
            #"interfaces.provides b: "b" is not an interface: <mod id>/<name>, each lower case letters,"#
                + #" digits, . _ - and at most 64 of them"#
        ),
        (
            minimal + #"[interfaces]\#nprovides = { "b/c" = [] }"#,
            #"interfaces.provides b/c must be a list of majors, as [1], not []"#
        ),
        (
            minimal + #"[interfaces]\#nprovides = { "b/c" = 1 }"#,
            #"interfaces.provides b/c must be a list of majors, as [1], not 1"#
        ),
        (
            minimal + #"[interfaces]\#nprovides = { "b/c" = ["1.0.0"] }"#,
            #"interfaces.provides b/c must be a list of majors, as [1], not ["1.0.0"]"#
        ),
        (
            minimal + #"[interfaces]\#nuses = { "b/c/d" = 1 }"#,
            #"interfaces.uses b/c/d: "b/c/d" is not an interface: <mod id>/<name>, each lower case letters,"#
                + #" digits, . _ - and at most 64 of them"#
        ),
        (
            minimal + #"[interfaces]\#nuses = { "b/c" = -1 }"#,
            #"interfaces.uses b/c must be a major, as 1, not -1"#
        ),
        (
            minimal + #"[interfaces]\#nuses = { "b/c" = [1] }"#,
            #"interfaces.uses b/c must be a major, as 1, not [1]"#
        ),
        (
            minimal + #"[permissions]\#n"deckit.mods" = " ""#,
            #"permission "deckit.mods" needs the reason it is asked for, as text"#
        ),
        (
            minimal + #"contributes = 1"#,
            #"contributes must be a [contributes] table of entry lists by interface,"#
                + #" as [[contributes."other/name"]] tables"#
        ),
        (
            minimal + #"[contributes]\#n"b/c" = 1"#,
            #"contributes b/c must be a list of tables, as [[contributes."other/name"]] tables"#
        ),
        (
            minimal + #"[contributes]\#n"b/c" = [1]"#,
            #"contributes b/c must be a list of tables, as [[contributes."other/name"]] tables"#
        ),
        (
            minimal + #"[[contributes."B/c"]]\#ntitle = "x""#,
            #"contributes B/c: "B/c" is not an interface: <mod id>/<name>, each lower case letters,"#
                + #" digits, . _ - and at most 64 of them"#
        )
    ]

    private let mods = Permission(id: "deckit.mods", name: "Mods", means: "Every mod.")
    private let network = Permission(id: "system.network", name: "Network", means: "The web.")
    private let any = Permission(id: "deckit.any", name: "Any", means: "Any mod.", privileged: true)
    private let sut: ManifestReader

    // MARK: - Initializer
    init() throws {
        sut = try ManifestReader(
            api: try #require(Version("1.2.0")),
            permissions: [mods, network, any],
            fields: [],
            store: Store()
        )
    }

    // MARK: - Test
    @Test("a manifest is read with its permissions, the widest first, and its entries by interface")
    func manifestIsRead() throws {
        // Given
        let text = """
            id = "notes"
            name = "Notes"
            version = "1.0.0"
            api = "1.1.0"
            main = "dist/main.js"
            background = "Keeps the pages in sync"
            [interfaces]
            provides = { "notes/pages" = [1, 2], "files/open" = [0] }
            uses = { "notes/pages" = 2, "files/store" = 1 }
            [permissions]
            "deckit.mods" = " to list them "
            "system.network" = "to sync"
            "system.camera" = "to see"
            [[contributes."files/open"]]
            title = "Open"
            [[contributes."files/open"]]
            title = "Pages"
            size = 2
            """

        // When
        let manifest = sut.read(text, fallback: "folder")

        // Then
        #expect(sut.problem(of: text, system: false) == nil)
        #expect(manifest.id == "notes")
        #expect(manifest.background == "Keeps the pages in sync")
        #expect(manifest.provides == ["notes/pages": [1, 2], "files/open": [0]])
        #expect(manifest.uses == ["notes/pages": 2, "files/store": 1])
        #expect(
            manifest.contributes == [
                "files/open": [
                    .object(["title": .string("Open")]),
                    .object(["title": .string("Pages"), "size": .number(2)])
                ]
            ]
        )
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
        #expect(sut.problem(of: text, system: false) == "manifest.toml: line 1: not a value this reads: ")
    }

    @Test("what is wrong with a manifest is said", arguments: problems)
    func problemIsSaid(text: String, problem: String) {
        // Given
        // When
        let said = sut.problem(of: text, system: false)

        // Then
        #expect(said == problem)
    }

    @Test("a privileged permission asked for is a problem but of a system mod")
    func privilegedPermissionIsForSystemMods() {
        // Given
        let text = Self.minimal + #"[permissions]\#n"deckit.any" = "to reach"\#n"deckit.mods" = "to list""#

        // When
        let mod = sut.problem(of: text, system: false)
        let system = sut.problem(of: text, system: true)

        // Then
        #expect(mod == #"permission "deckit.any" is granted only to a system mod"#)
        #expect(system == nil)
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
