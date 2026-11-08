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
        (ErasureError.notAPrincipal("x"), "MOD"),
        (ConnectionError.notRunning("a"), "NOT_RUNNING"),
        (ConnectionError.ended, "ENDED_CONNECTION"),
        (ConnectionError.notAnEnd(principal: "a"), "NOT_AN_END"),
        (ConnectionError.lifecycleEnded(Endpoint(principal: "a", run: 1, lifecycle: 0)), "NOT_UP"),
        (ConnectionError.ownId("a"), "REFUSED"),
        (ConnectionError.outOfReach(principal: "b", client: "a"), "REFUSED"),
        (ConnectionError.notExported(name: "b", principal: "b"), "NOT_EXPORTED"),
        (InstallError.nested, "NESTED"),
        (InstallError.notInstalled("a"), "NOT_INSTALLED"),
        (InstallError.readInPlace(id: "a", folder: "/a"), "READ_IN_PLACE"),
        (LaunchError.notPermitted(mod: "a", permission: "deckit.mods"), "NOT_PERMITTED"),
        (LaunchError.notInstalled("a"), "NOT_INSTALLED"),
        (LaunchError.relaunchLimit("a"), "RELAUNCH_LIMIT"),
        (LaunchError.timedOut(mod: "a", problem: "late"), "TIMED_OUT"),
        (LaunchError.notLaunched(mod: "a", problem: "threw"), "NOT_LAUNCHED"),
        (DeckSettingsError.unreadable("deck.json"), "UNREADABLE"),
        (PinError.notProvider(interface: "x/api", principal: "a"), "NOT_PROVIDER"),
        (LifecycleError.transition(principal: "a", number: 1, transition: .crash, state: .notRunning), "TRANSITION"),
        (ModFolderError.notLoadable("p"), "NOT_LOADABLE"),
        (ManifestError.permissionDefined("p"), "PERMISSION"),
        (ManifestError.fieldDefined("f"), "FIELD"),
        (PrincipalStorageError.notAPrincipal("x"), "MOD"),
        (RecordError.notAKey("k"), "KEY"),
        (PrincipalStateError.notAName("N"), "NAME"),
        (PrincipalStateError.reserved("n"), "RESERVED"),
        (StateError.notAKey("k"), "KEY"),
        (StateError.notAFolder("f"), "FOLDER"),
        (StateError.reserved("keys"), "RESERVED"),
    ]

    private static let stages: [(any Refusal, String)] = [
        (ModFolderError.notLoadable("p"), "read"),
        (LaunchError.relaunchLimit("a"), "launch"),
        (LaunchError.timedOut(mod: "a", problem: "late"), "launch"),
        (LaunchError.notLaunched(mod: "a", problem: "threw"), "launch"),
        (LaunchError.notPermitted(mod: "a", permission: "deckit.mods"), "call"),
        (LaunchError.notInstalled("a"), "call"),
        (InstallError.nested, "call"),
        (InstallError.readInPlace(id: "a", folder: "/a"), "call"),
        (RecordError.notAKey("k"), "call"),
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
            adding: "icon = \"a.png\"\n[interfaces]\nprovides = { \"a/api\" = [1], \"a/own\" = [1] }\n[permissions]\n"
                + "\"deckit.example\" = \"to test\"\n\"system.example\" = \"to test\"\n"
                + "[[contributes.\"a/api\"]]\ntitle = \"Size\"\nsize = 12"
        )
        try writeMod("b", in: "source", adding: "[interfaces]\nuses = { \"a/api\" = 1, \"a/own\" = 1 }")
        try writeMod(
            "c",
            in: "ship",
            adding: "background = \"to test\"\n[interfaces]\nprovides = { \"a/api\" = [1] }\n[permissions]\n"
                + "\"deckit.privileged\" = \"to test\"\n\"deckit.reach-mods\" = \"to test\"\n\"deckit.mods\" = \"to test\""
        )
        try writeMod("f", in: "source", adding: "colour = \"blue\"")
        try writeMod("d", in: "spare")
        try writeMod("e", in: "spare", adding: "[permissions]\n\"deckit.privileged\" = \"to test\"")
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

    @Test("a refusal crosses with the stage it is refused at", arguments: stages)
    func refusalHasItsStage(refusal: any Refusal, stage: String) {
        // Given
        // When
        let sut = ResponseError(refusing: refusal)

        // Then
        #expect(sut.stage == stage)
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
