//
//  ModFolderTests.swift
//  DeckitTests
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("ModFolder")
struct ModFolderTests {
    // MARK: - Property
    private let root = FileManager.default.temporaryDirectory.appending(path: "mod-folder-tests-\(UUID().uuidString)")
    private let sut: ModFolder

    // MARK: - Initializer
    init() throws {
        let reader = try ManifestReader(
            api: try #require(Version("1.0.0")),
            permissions: [],
            fields: [],
            store: Store()
        )
        sut = ModFolder(reader: reader, store: Store())
    }

    // MARK: - Test
    @Test("a folder is a mod only where it holds a regular file named manifest.toml as the same scalar values")
    func onlyAManifestFileMakesAMod() throws {
        // Given
        try write("notes", main: "main.js")
        try write("shelf", main: "main.js", manifest: "Manifest.toml")
        try write("rack", main: "main.js", manifest: "spare.toml")
        try FileManager.default.createDirectory(
            at: root.appending(path: "rack/manifest.toml"),
            withIntermediateDirectories: true
        )

        // When
        let mods = sut.mods(in: root)

        // Then
        #expect(mods.map(\.lastPathComponent) == ["notes"])
        #expect(sut.problem(of: root.appending(path: "shelf"), system: false) != nil)
    }

    @Test("a segment of a path names only the entry whose name is the same scalar values, in case and in form")
    func segmentsMatchExactly() throws {
        // Given
        try write("notes", main: "lib/caf\u{E9}.js")

        // When
        let folder = root.appending(path: "notes")
        let exact = sut.file("lib/caf\u{E9}.js", in: folder)
        let otherCase = sut.file("Lib/caf\u{E9}.js", in: folder)
        let otherForm = sut.file("lib/cafe\u{301}.js", in: folder)

        // Then
        #expect(exact != nil)
        #expect(otherCase == nil)
        #expect(otherForm == nil)
    }

    @Test("a main in another case than its file names no file, and the mod is refused")
    func mainInAnotherCaseIsRefused() throws {
        // Given
        try write("notes", main: "main.js", writing: "Main.js")

        // When
        let problem = sut.problem(of: root.appending(path: "notes"), system: false)

        // Then
        #expect(problem == .notLoadable(#"main = "Main.js" names no file in the mod's folder"#))
    }

    @Test("a link inside the folder is followed to the regular file it names")
    func linkIsFollowed() throws {
        // Given
        try write("notes", main: "main.js", writing: "entry.js")
        let folder = root.appending(path: "notes")
        try FileManager.default.createSymbolicLink(
            atPath: folder.appending(path: "entry.js").path(percentEncoded: false),
            withDestinationPath: "main.js"
        )

        // When
        let file = sut.file("entry.js", in: folder)

        // Then
        #expect(file?.lastPathComponent == "main.js")
        #expect(sut.problem(of: folder, system: false) == nil)
    }

    @Test("a link's target names only the entries whose names are the same scalar values, as a path does")
    func linkTargetMatchesExactly() throws {
        // Given
        try write("notes", main: "main.js", writing: "entry.js")
        let folder = root.appending(path: "notes")
        try FileManager.default.createSymbolicLink(
            atPath: folder.appending(path: "entry.js").path(percentEncoded: false),
            withDestinationPath: "Main.js"
        )

        // When
        let file = sut.file("entry.js", in: folder)

        // Then
        #expect(file == nil)
    }

    @Test("a link among the mod folders is followed to the folder it names, and a regular file is no mod")
    func linkAmongModsIsFollowed() throws {
        // Given
        try write("holder/notes", main: "main.js")
        try FileManager.default.createSymbolicLink(
            atPath: root.appending(path: "shelf").path(percentEncoded: false),
            withDestinationPath: "holder/notes"
        )
        try FileManager.default.createSymbolicLink(
            atPath: root.appending(path: "rack").path(percentEncoded: false),
            withDestinationPath: "Holder/notes"
        )
        try Data("not a mod".utf8).write(to: root.appending(path: "file"))

        // When
        let mods = sut.mods(in: root)

        // Then
        #expect(mods.map(\.lastPathComponent) == ["shelf"])
    }

    // MARK: - Private
    // A mod folder `name` holding the file `main` and a manifest at `manifest` whose main is `written`, or `main`. The
    // file is made by the bytes of its name as written: a URL's path holds a name decomposed.
    private func write(
        _ name: String,
        main: String,
        manifest: String = "manifest.toml",
        writing written: String? = nil
    ) throws {
        let folder = root.appending(path: name)
        try FileManager.default.createDirectory(
            at: folder.appending(path: main).deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let descriptor = open(folder.path(percentEncoded: false) + "/" + main, O_CREAT | O_WRONLY, 0o644)
        try #require(descriptor >= 0)
        close(descriptor)
        let text = """
            id = "\(name)"
            version = "1.0.0"
            api = "1.0.0"
            main = "\(written ?? main)"
            """
        try Data(text.utf8).write(to: folder.appending(path: manifest))
    }
}
