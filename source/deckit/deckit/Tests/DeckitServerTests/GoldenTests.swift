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
        (ConnectionError.notRunning("a"), "NOT_RUNNING"),
        (ConnectionError.ended, "ENDED_CONNECTION"),
        (ConnectionError.notAnEnd(mod: "a"), "NOT_AN_END"),
        (InstallError.notLoadable("p"), "NOT_LOADABLE"),
        (InstallError.installedThere, "INSTALLED_THERE"),
        (InstallError.nested, "NESTED"),
        (InstallError.occupied(id: "a", folder: "/a"), "OCCUPIED"),
        (InstallError.refused("p"), "REFUSED"),
        (InstallError.notInstalled("a"), "NOT_INSTALLED"),
        (InstallError.readInPlace(id: "a", folder: "/a"), "READ_IN_PLACE"),
        (OrderError.requiredLater(mod: "b", requirement: "a"), "REQUIRED_LATER"),
        (DeckSettingsError.unreadable("deck.json"), "UNREADABLE"),
        (PinError.notProvider(interface: "x/api", mod: "a"), "NOT_PROVIDER"),
        (StartupError.notAsked("a"), "NOT_ASKED"),
        (LifecycleError.transition(modId: "a", number: 1, transition: .crash, state: .notRunning), "TRANSITION"),
        (ManifestError.permissionDefined("p"), "PERMISSION"),
        (ManifestError.fieldDefined("f"), "FIELD"),
        (ModStorageError.notAMod("x"), "MOD"),
        (RecordError.notAKey("k"), "KEY"),
        (ModStateError.notAName("N"), "NAME"),
        (ModStateError.reserved("n"), "RESERVED"),
        (StateError.notAKey("k"), "KEY"),
        (StateError.notAFolder("f"), "FOLDER"),
        (StateError.reserved("keys"), "RESERVED"),
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
            adding: "[interfaces]\nprovides = { \"a/api\" = [1] }\n[permissions]\n"
                + "\"system.global-keys\" = \"to test\"\n\"system.example\" = \"to test\"",
            contributes: #"{"configuration":[{"default":12,"key":"size","minimum":8,"title":"Size","type":"number"},"#
                + #"{"default":"mono","key":"font","oneOf":[{"const":"mono","title":"Mono"}],"type":"string"},"#
                + #"{"default":"x","key":"bad","oneOf":[{"const":"y"}],"type":"string"}]}"#
        )
        try writeMod("b", in: "source", adding: "[dependencies]\na = \"1.0.0\"\n[interfaces]\nuses = { \"a/api\" = 1 }")
        try writeMod("c", in: "ship", adding: "[interfaces]\nprovides = { \"a/api\" = [1] }")
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

    private func writeMod(
        _ id: String,
        in folder: String,
        adding extra: String = "",
        contributes: String? = nil
    ) throws {
        let location = root.appending(path: folder).appending(path: id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let manifest = """
            id = "\(id)"
            name = "\(id.uppercased())"
            version = "1.0.0"
            api = "1.0.0"
            main = "main.js"
            """ + (contributes == nil ? "" : "\ncontributes = \"contributes.json\"")
            + (extra.isEmpty ? "" : "\n" + extra)
        try Data(manifest.utf8).write(to: location.appending(path: "manifest.toml"))
        if let contributes {
            try Data(contributes.utf8).write(to: location.appending(path: "contributes.json"))
        }
        try Data().write(to: location.appending(path: "main.js"))
    }
}
