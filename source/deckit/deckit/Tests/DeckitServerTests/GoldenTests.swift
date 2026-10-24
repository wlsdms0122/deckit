//
//  GoldenTests.swift
//  DeckitServerTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
import Deckit
@testable import DeckitServer

// What the driver reads, pinned: `Golden/session.jsonl` asks every method, with its refusals, and
// `Golden/answers.jsonl` is each answer. Folders are written `@HOME@`, `@SOURCE@`, `@SHIP@` and `@SPARE@`.
@Suite("Golden")
struct GoldenTests {
    // MARK: - Property
    private static let refusals: [(any Refusal, String)] = [
        (ErasureError.notAMod("x"), "MOD"),
        (ExportError.notADependency(mod: "a", of: "b"), "DEPENDENCY"),
        (ExportError.notRunning("a"), "NOT_RUNNING"),
        (ExportError.otherVersion(mod: "a", version: "1.0.0", dependent: "b", wanted: "2.0.0"), "VERSION"),
        (ExportError.noSuchFunction(mod: "a", path: ["f"]), "FUNCTION"),
        (ExtensionError.notAPoint("p", of: "a"), "POINT"),
        (ExtensionError.notRunning("a"), "NOT_RUNNING"),
        (ExtensionError.notExtending(mod: "a", point: "b:p"), "EXTENSION"),
        (ExtensionError.noSuchFunction(mod: "a", point: "b:p", path: ["f"]), "FUNCTION"),
        (InstallError.notLoadable("p"), "NOT_LOADABLE"),
        (InstallError.installedThere, "INSTALLED_THERE"),
        (InstallError.nested, "NESTED"),
        (InstallError.occupied(id: "a", folder: "/a"), "OCCUPIED"),
        (InstallError.refused("p"), "REFUSED"),
        (InstallError.notInstalled("a"), "NOT_INSTALLED"),
        (InstallError.readInPlace(id: "a", folder: "/a"), "READ_IN_PLACE"),
        (LoadOrderError.requiredLater(mod: "b", requirement: "a"), "REQUIRED_LATER"),
        (LoadOrderError.unreadable("deck.json"), "UNREADABLE"),
        (LifecycleError.transition(modId: "a", number: 1, transition: .crash, state: .notRunning), "TRANSITION"),
        (ManifestError.permissionDefined("p"), "PERMISSION"),
        (ManifestError.fieldDefined("f"), "FIELD"),
        (ModStorageError.notAMod("x"), "MOD"),
        (RecordError.notAKey("k"), "KEY"),
        (SettingError.undeclared(mod: "a", key: "k"), "UNDECLARED"),
        (SettingError.notAnAction(mod: "a", key: "k"), "NOT_AN_ACTION"),
        (SettingError.isAnAction("k"), "ACTION"),
        (SettingError.notOfType(key: "k", type: .number), "TYPE"),
        (SettingError.notAnOption(key: "k", value: nil), "OPTION"),
        (StateError.notAKey("k"), "KEY"),
        (StateError.notAFolder("f"), "FOLDER"),
        (StateError.reserved("keys"), "RESERVED"),
        (KeymapError.noSuchBinding("@app.x"), "SHORTCUT"),
        (KeymapError.notAChord("x"), "CHORD"),
        (KeymapError.cannotReach(label: "C", reach: .app), "REFUSED"),
        (URLRouterError.noHandlers("x"), "SCHEME")
    ]

    private let root = FileManager.default.temporaryDirectory.appending(path: "golden-tests-\(UUID().uuidString)")

    // MARK: - Initializer
    // MARK: - Test
    @Test("each method answers as the driver reads it")
    func eachMethodAnswersAsPinned() throws {
        // Given
        try writeMod(
            "a",
            in: "source",
            adding: "url-schemes = [\"mailto\"]\n[permissions]\n\"system.global-keys\" = \"to test\""
        )
        try writeMod("b", in: "source", adding: "[requires]\na = \"1.0.0\"")
        try writeMod("c", in: "ship")
        try writeMod("d", in: "spare")
        let requests = try lines(of: "session")
        let pinned = try lines(of: "answers")
        let sut = Server()

        // When
        let answers = try requests.map { request in
            let answer = try #require(sut.respond(to: Data(placed(request).utf8)))
            return unplaced(String(decoding: answer, as: UTF8.self))
        }

        // Then
        #expect(answers.count == pinned.count)
        for (request, (answer, expected)) in zip(requests, zip(answers, pinned)) where answer != expected {
            Issue.record("\(request)\nanswered \(answer)\npinned   \(expected)")
        }
    }

    @Test("a refusal crosses with the kind the driver tells it by", arguments: refusals)
    func refusalHasItsKind(refusal: any Refusal, kind: String) {
        // Given
        // When
        let sut = ResponseError(refusing: refusal)

        // Then
        #expect(sut.kind == kind)
        #expect(sut.code == .requestFailed)
        #expect(sut.message == refusal.message)
    }

    // MARK: - Private
    private var folders: [(placeholder: String, path: String)] {
        ["home", "source", "ship", "spare"].map { name in
            ("@\(name.uppercased())@", root.appending(path: name).path(percentEncoded: false))
        }
    }

    private func lines(of name: String) throws -> [String] {
        let file = try #require(Bundle.module.url(forResource: name, withExtension: "jsonl", subdirectory: "Golden"))
        return try String(contentsOf: file, encoding: .utf8).split(separator: "\n").map(String.init)
    }

    private func placed(_ request: String) -> String {
        folders.reduce(request) { text, folder in text.replacing(folder.placeholder, with: folder.path) }
    }

    // Each folder back to its placeholder, as it is written in JSON and as the disk resolves it: a Mac's temporary
    // folder is a link into /private.
    private func unplaced(_ answer: String) -> String {
        folders.reduce(answer) { text, folder in
            ["/private" + folder.path, folder.path].reduce(text) { text, path in
                text.replacing(path.replacing("/", with: "\\/"), with: folder.placeholder)
                    .replacing(path, with: folder.placeholder)
            }
        }
    }

    private func writeMod(_ id: String, in folder: String, adding extra: String = "") throws {
        let location = root.appending(path: folder).appending(path: id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let manifest = """
            id = "\(id)"
            name = "\(id.uppercased())"
            version = "1.0.0"
            api = "1.0.0"
            main = "main.js"
            """ + (extra.isEmpty ? "" : "\n" + extra)
        try Data(manifest.utf8).write(to: location.appending(path: "manifest.toml"))
        try Data().write(to: location.appending(path: "main.js"))
    }
}
