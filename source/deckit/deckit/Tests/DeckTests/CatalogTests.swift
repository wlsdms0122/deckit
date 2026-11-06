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

    // MARK: - Initializer
    init() {
        root = FileManager.default.temporaryDirectory.appending(path: "catalog-tests-\(UUID().uuidString)")
        home = root.appending(path: "home")
        source = root.appending(path: "source")
        ship = root.appending(path: "ship")
    }

    // MARK: - Test
    @Test("each comes as the app ships it, then by id, whether it loads or not")
    func modsComeInOrder() throws {
        // Given
        try write("c", in: home.appending(path: "mods"))
        try write("b", in: home.appending(path: "mods"))
        try write("a", in: home.appending(path: "mods"))
        try write("d", in: home.appending(path: "mods"), main: nil)
        try write("e", in: ship)
        let sut = try catalog(ship: [ship.appending(path: "e")])
        _ = try sut.installShipped()

        // When
        let mods = sut.mods()

        // Then
        #expect(mods.map(\.manifest.id) == ["e", "a", "b", "c", "d"])
        #expect(mods.last?.problem == #"main = "missing.js" names no file in the mod's folder"#)
    }

    @Test("what a mod's contributes file declares is carried as written, and a file that holds no JSON object fails it")
    func contributesAreCarried() throws {
        // Given
        try write("a", in: source, contributes: #"{ "commands": { "open": {} }, "unknown": [1] }"#)
        try write("b", in: source, contributes: "[]")
        try write("c", in: source, contributes: "{")
        try write("d", in: source)
        let sut = try catalog(sources: [source])

        // When
        let mods = sut.mods()

        // Then
        #expect(mods[0].contributes == [
            "commands": .object(["open": .object([:])]),
            "unknown": .array([.number(1)])
        ])
        #expect(mods[0].problem == nil)
        #expect(mods[1].problem == "contributes.json must hold a JSON object")
        #expect(mods[2].problem == "contributes.json must hold a JSON object")
        #expect(mods[3].contributes.isEmpty)
    }

    @Test("a file read inside a mod's folder is one there, by a link too, and none outside it or of a mod that fails")
    func fileIsReadInsideTheFolder() throws {
        // Given
        try write("a", in: source)
        try write("b", in: source, main: nil)
        let folder = source.appending(path: "a")
        try FileManager.default.createDirectory(at: folder.appending(path: "styles"), withIntermediateDirectories: true)
        try Data("body {}".utf8).write(to: folder.appending(path: "styles/page.css"))
        try Data("secret".utf8).write(to: source.appending(path: "outside.css"))
        try FileManager.default.createSymbolicLink(
            at: folder.appending(path: "inside.css"),
            withDestinationURL: folder.appending(path: "styles/page.css")
        )
        try FileManager.default.createSymbolicLink(
            at: folder.appending(path: "outside.css"),
            withDestinationURL: source.appending(path: "outside.css")
        )
        try Data("body {}".utf8).write(to: source.appending(path: "b/page.css"))
        let sut = try catalog(sources: [source])
        _ = sut.read()

        // When
        let texts = [
            sut.text(of: "styles/page.css", in: "a"),
            sut.text(of: "inside.css", in: "a"),
            sut.text(of: "outside.css", in: "a"),
            sut.text(of: "../outside.css", in: "a"),
            sut.text(of: "styles", in: "a"),
            sut.text(of: "page.css", in: "b")
        ]

        // Then
        #expect(texts == ["body {}", "body {}", nil, nil, nil, nil])
    }

    @Test("a mod read in place comes before an installed copy of its id, which it hides")
    func sourceHidesInstalled() throws {
        // Given
        try write("a", in: source)
        try write("a", in: home.appending(path: "mods"))
        let sut = try catalog(sources: [source])

        // When
        let mods = sut.mods()
        let removed = Result { try sut.remove("a") }

        // Then
        #expect(mods.count == 1)
        #expect(mods.first?.installed == false)
        #expect(mods.first?.hides.map(\.lastPathComponent) == ["a"])
        #expect(throws: InstallError.self) { try removed.get() }
    }

    @Test("a mod's data folder is deck's, named by its id, wherever the mod is read from")
    func dataFolderIsNamedById() throws {
        // Given
        try write("a", in: source, folder: "a-source")
        try write("b", in: home.appending(path: "mods"))
        let sut = try catalog(sources: [source])

        // When
        let mods = sut.mods()

        // Then
        #expect(mods.map(\.data) == ["a", "b"].map { id in home.appending(path: "data/\(id)") })
    }

    @Test("the mods that stand in a list carry what is wrong with what they declare, as reading found it")
    func listedCarryDeclarationProblems() throws {
        // Given
        try write("a", in: source)
        try write("b", in: source)
        let sut = try catalog(sources: [source])

        // When
        _ = sut.read { mod in mod.manifest.id == "a" ? ["wrong"] : [] }

        // Then
        #expect(sut.listed.map(\.manifest.id) == ["a", "b"])
        #expect(sut.listed.map(\.declarationProblems) == [["wrong"], []])
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

    @Test("a relation says why it is not there at the version named, an optional one only of a version not satisfied")
    func relationSaysWhy() throws {
        // Given
        try write("x", in: source, version: "1.2.0")
        try write("y", in: source, requires: ["x": "2.0.0"], optional: ["v": "1.0.0"])
        try write("z", in: source, optional: ["x": "2.0.0"])
        let sut = try catalog(sources: [source])

        // When
        let problems = Dictionary(
            uniqueKeysWithValues: sut.mods().flatMap { mod in
                mod.relations.map { relation in ("\(mod.manifest.id) \(relation.id)", relation.problem) }
            }
        )

        // Then
        #expect(
            problems == [
                "y x": "needs x 2.0.0, and x is 1.2.0",
                "y v": nil,
                "z x": "uses x 2.0.0, and x is 1.2.0, so it runs without it",
            ]
        )
    }

    @Test("a mod lists the mods that load and require it, directly or through another")
    func dependentsReachThrough() throws {
        // Given
        try write("x", in: source)
        try write("y", in: source, requires: ["x": "1.0.0"])
        try write("z", in: source, requires: ["y": "1.0.0"])
        try write("w", in: source, requires: ["x": "1.0.0", "v": "1.0.0"])
        let sut = try catalog(sources: [source])

        // When
        let dependents = Dictionary(uniqueKeysWithValues: sut.mods().map { mod in (mod.manifest.id, mod.dependents) })

        // Then
        #expect(dependents == ["x": ["y", "z"], "y": ["z"], "z": [], "w": []])
    }

    @Test("each comes after what it requires, else where the order kept places it, which reading leaves as it is")
    func orderPutsRequirementsFirst() throws {
        // Given
        try write("a", in: source)
        try write("b", in: source, requires: ["a": "1.0.0"])
        try write("c", in: source)
        try write("d", in: source, main: nil)
        let settings = home.appending(path: "deck.json")
        try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
        try Data(#"{"order":["c","b","a"],"other":1}"#.utf8).write(to: settings)
        let sut = try catalog(sources: [source])

        // When
        let mods = sut.read()

        // Then
        #expect(mods.map(\.manifest.id) == ["c", "a", "b", "d"])
        #expect(try String(contentsOf: settings, encoding: .utf8) == #"{"order":["c","b","a"],"other":1}"#)
    }

    @Test("installing or removing keeps the order: one installed takes its place, one removed leaves")
    func installKeepsOrder() throws {
        // Given
        try write("a", in: home.appending(path: "mods"))
        try write("c", in: home.appending(path: "mods"))
        try write("b", in: source)
        let settings = home.appending(path: "deck.json")
        try Data(#"{"order":["c","a"],"other":1}"#.utf8).write(to: settings)
        let sut = try catalog()

        // When
        _ = try sut.install(from: source.appending(path: "b"))
        let installed = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: settings))
        _ = try sut.remove("a")
        let removed = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: settings))

        // Then
        #expect(installed == .object(["order": .array(["c", "a", "b"].map(JSONValue.string)), "other": .number(1)]))
        #expect(removed == .object(["order": .array(["c", "b"].map(JSONValue.string)), "other": .number(1)]))
    }

    @Test("one that does not load keeps its place, and one it requires found anew goes just before it")
    func failedModKeepsItsPlace() throws {
        // Given
        try write("a", in: source)
        try write("x", in: source, requires: ["y": "1.0.0"])
        try write("b", in: source)
        try write("y", in: source)
        let sut = try catalog(sources: [source])
        try sut.arrange(["a", "y", "x", "b"])
        try FileManager.default.removeItem(at: source.appending(path: "y"))

        // When
        let failed = sut.read()
        try write("y", in: source)
        let back = sut.read()

        // Then
        #expect(failed.map(\.manifest.id) == ["a", "x", "b"])
        #expect(failed.map(\.problem) == [nil, "needs y, which is not installed", nil])
        #expect(back.map(\.manifest.id) == ["a", "y", "x", "b"])
        #expect(back.allSatisfy { mod in mod.problem == nil })
    }

    @Test("arranging moves the ids named among the places they held, refusing one with a mod before what it requires")
    func arrangeKeepsRequirementsFirst() throws {
        // Given
        for id in ["a", "c", "d"] {
            try write(id, in: source)
        }
        try write("b", in: source, requires: ["a": "1.0.0"])
        try write("e", in: source, requires: ["f": "1.0.0"])
        try write("f", in: source, requires: ["e": "1.0.0"])
        try write("g", in: source, optional: ["h": "1.0.0"])
        try write("h", in: source)
        let sut = try catalog(sources: [source])

        // When
        try sut.arrange(["d", "f", "c", "x", "d", "e", "g", "h"])
        let arranged = sut.mods().map(\.manifest.id)
        let refused = Result { try sut.arrange(["b", "a"]) }

        // Then
        #expect(arranged == ["a", "b", "d", "f", "c", "e", "g", "h"])
        #expect(throws: OrderError.requiredLater(mod: "b", requirement: "a")) { try refused.get() }
        #expect(sut.mods().map(\.manifest.id) == arranged)
    }

    @Test("a settings file that does not read as a JSON object is neither read for an order nor written over")
    func unreadableSettingsStay() throws {
        // Given
        try write("b", in: source)
        try write("a", in: source)
        let settings = home.appending(path: "deck.json")
        try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
        try Data(#"{"order":["b","a"],"#.utf8).write(to: settings)
        let sut = try catalog(sources: [source])

        // When
        let mods = sut.read()
        let refused = Result { try sut.arrange(["b", "a"]) }

        // Then
        #expect(mods.map(\.manifest.id) == ["a", "b"])
        #expect(throws: DeckSettingsError.unreadable("deck.json")) { try refused.get() }
        #expect(try String(contentsOf: settings, encoding: .utf8) == #"{"order":["b","a"],"#)
    }

    @Test("installing copies the folder as mods/<id>, replacing every copy before it, and changes the revision")
    func installReplacesCopies() throws {
        // Given
        try write("a", in: home.appending(path: "mods"), folder: "old-a")
        try write("a", in: source, version: "2.0.0")
        let sut = try catalog()
        let before = try #require(sut.mods().first)

        // When
        let plan = try sut.planInstall(from: source.appending(path: "a"))
        let manifest = try sut.install(from: source.appending(path: "a"))

        // Then
        let after = try #require(sut.mods().first)
        #expect(plan.replaces)
        #expect(manifest.version == "2.0.0")
        #expect(after.folder.lastPathComponent == "a")
        #expect(after.manifest.version == "2.0.0")
        #expect(after.revision != before.revision)
        #expect(!FileManager.default.fileExists(atPath: home.appending(path: "mods/old-a").path(percentEncoded: false)))
        let staging = home.appending(path: ".mods-installing")
        #expect(!FileManager.default.fileExists(atPath: staging.path(percentEncoded: false)))
    }

    @Test("installing what the app ships places what the order did not, and every place kept stays")
    func installShippedKeepsOrder() throws {
        // Given
        try write("x", in: source)
        try write("a", in: ship)
        try write("b", in: ship, requires: ["a": "1.0.0"])
        let settings = home.appending(path: "deck.json")
        try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
        try Data(#"{"order":["x","gone","b"]}"#.utf8).write(to: settings)
        let sut = try catalog(sources: [source], ship: [ship.appending(path: "a"), ship.appending(path: "b")])

        // When
        _ = try sut.installShipped()

        // Then
        let kept = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: settings))
        #expect(kept == .object(["order": .array(["x", "gone", "a", "b"].map(JSONValue.string))]))
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
        let installed = Result { try sut.planInstall(from: home.appending(path: "mods/a")) }
        let unloadable = Result { try sut.planInstall(from: root.appending(path: "b")) }
        let hidden = Result { try sut.planInstall(from: root.appending(path: "other/c")) }

        // Then
        #expect(throws: InstallError.installedThere) { try installed.get() }
        #expect(throws: InstallError.notLoadable(#"main = "missing.js" names no file in the mod's folder"#)) {
            try unloadable.get()
        }
        let shadow = "c is read from \(source.appending(path: "c").path(percentEncoded: false)), which would hide the "
            + "installed copy"
        #expect(throws: InstallError.refused(shadow)) { try hidden.get() }
    }

    @Test("what the app ships is installed, but not again once the person removed it")
    func shippedRemovedStaysOut() throws {
        // Given
        try write("a", in: ship)
        try write("b", in: ship, main: nil)
        let shipped = [ship.appending(path: "a"), ship.appending(path: "b")]
        let sut = try catalog(ship: shipped)

        // When
        let outcomes = try sut.installShipped()
        _ = try sut.remove("a")
        let restarted = try catalog(ship: shipped)
        let again = try restarted.installShipped()
        let mods = restarted.mods()

        // Then
        #expect(outcomes.map(\.outcome) == [.installed, .failed])
        #expect(again.map(\.outcome) == [.leftOut, .failed])
        #expect(mods.map(\.problem) == [#"did not install: main = "missing.js" names no file in the mod's folder"#])
    }

    @Test("what the app ships that asks to run from the start is approved as it installs, until the person decides")
    func shippedStartupIsApproved() throws {
        // Given
        try write("a", in: ship, startup: "Runs a service")
        try write("b", in: ship)
        try write("c", in: source, startup: "Runs a service")
        let shipped = [ship.appending(path: "a"), ship.appending(path: "b")]
        let sut = try catalog(sources: [source], ship: shipped)

        // When
        _ = try sut.installShipped()
        let approved = sut.mods().filter(\.startupApproved).map(\.manifest.id)
        try sut.approveStartup("a", false)
        let restarted = try catalog(sources: [source], ship: shipped)
        _ = try restarted.installShipped()
        let removed = restarted.mods().filter(\.startupApproved).map(\.manifest.id)
        try restarted.approveStartup("c", true)

        // Then
        #expect(approved == ["a"])
        #expect(removed.isEmpty)
        #expect(restarted.mods().filter(\.startupApproved).map(\.manifest.id) == ["c"])
    }

    @Test("only a mod whose manifest asks to run from the start is approved to")
    func startupNeedsAsking() throws {
        // Given
        try write("a", in: source)
        try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
        try Data(#"{"startup":{"a":true}}"#.utf8).write(to: home.appending(path: "deck.json"))
        let sut = try catalog(sources: [source])

        // When
        let approved = sut.mods().filter(\.startupApproved)

        // Then
        #expect(approved.isEmpty)
        #expect(throws: StartupError.notAsked("a")) { try sut.approveStartup("a", true) }
        #expect(throws: StartupError.notAsked("x")) { try sut.approveStartup("x", true) }
    }

    @Test("what the app ships that fails to install says why, and is no installed mod")
    func shippedFailedIsNotInstalled() throws {
        // Given
        try write("b", in: ship, main: nil)
        try write("b", in: source)
        let sut = try catalog(ship: [ship.appending(path: "b")])

        // When
        _ = try sut.installShipped()
        let mods = sut.mods()
        let installing = try sut.planInstall(from: source.appending(path: "b"))
        let removed = Result { try sut.remove("b") }

        // Then
        #expect(mods.map(\.problem) == [#"did not install: main = "missing.js" names no file in the mod's folder"#])
        #expect(installing.manifest.id == "b")
        #expect(!installing.replaces)
        #expect(throws: InstallError.notInstalled("b")) { try removed.get() }
    }

    @Test("removing a mod whose manifest names no mod id answers that deck keeps nothing under it")
    func removeAnswersWhetherIdKeepsData() throws {
        // Given
        try write("A", in: home.appending(path: "mods"))
        try write("a", in: home.appending(path: "mods"), folder: "a-copy")
        let sut = try catalog()

        // When
        let other = try sut.remove("A")
        let own = try sut.remove("a")

        // Then
        #expect(other == false)
        #expect(own == true)
    }

    @Test("a mod joins the end of an interface's queue as it starts to provide it, and leaves it as it stops")
    func queueFollowsWhatModsProvide() throws {
        // Given
        let spare = root.appending(path: "spare")
        try write("a", in: source, provides: ["x/api": [1], "y/api": [1]])
        try write("b", in: source, provides: ["x/api": [1]])
        try write("c", in: spare, provides: ["x/api": [1]])
        let sut = try catalog(sources: [source])

        // When
        let first = queues(of: sut)
        try write("a", in: source, provides: ["y/api": [1], "z/api": [1]])
        let updated = queues(of: sut)
        try write("a", in: source, provides: ["x/api": [1], "y/api": [1], "z/api": [1]])
        let providing = queues(of: sut)
        _ = try sut.install(from: spare.appending(path: "c"))
        let installed = queues(of: sut)
        _ = try sut.remove("c")
        let removed = queues(of: sut)
        try FileManager.default.removeItem(at: source.appending(path: "b"))
        let gone = queues(of: sut)
        let kept = queues(of: try catalog(sources: [source]))

        // Then
        #expect(first == ["x/api": ["a", "b"], "y/api": ["a"]])
        #expect(updated == ["x/api": ["b"], "y/api": ["a"], "z/api": ["a"]])
        #expect(providing == ["x/api": ["b", "a"], "y/api": ["a"], "z/api": ["a"]])
        #expect(installed == ["x/api": ["b", "a", "c"], "y/api": ["a"], "z/api": ["a"]])
        #expect(removed == ["x/api": ["b", "a"], "y/api": ["a"], "z/api": ["a"]])
        #expect(gone == ["x/api": ["a"], "y/api": ["a"], "z/api": ["a"]])
        #expect(kept == gone)
    }

    @Test("providers arriving at once queue in the app's ship order, then by id, and a mod that does not load is none")
    func queueTiesComeInShipOrder() throws {
        // Given
        try write("b", in: source, provides: ["x/api": [1]])
        try write("a", in: source, provides: ["x/api": [1]])
        try write("f", in: source, main: nil, provides: ["x/api": [1]])
        try write("s", in: ship, provides: ["x/api": [1]])
        let sut = try catalog(sources: [source], ship: [ship.appending(path: "s")])
        _ = try sut.installShipped()

        // When
        let queues = queues(of: sut)

        // Then
        #expect(queues == ["x/api": ["s", "a", "b"]])
        #expect(sut.interfaces.map(\.owner) == ["s"])
    }

    @Test("a provider that does not load only for what it requires keeps its place in the queue, and still owns")
    func providerFailingByRequirementKeepsPlace() throws {
        // Given
        let spare = root.appending(path: "spare")
        try write("a", in: source, provides: ["x/api": [1]])
        try write("b", in: source, provides: ["x/api": [1]])
        try write("m", in: spare)
        let sut = try catalog(sources: [source])
        let first = queues(of: sut)

        // When
        try write("a", in: source, provides: ["x/api": [1]], requires: ["m": "1.0.0"])
        let failing = queues(of: sut)
        let failed = sut.read().first { mod in mod.manifest.id == "a" }
        _ = try sut.install(from: spare.appending(path: "m"))
        let loading = queues(of: sut)

        // Then
        #expect(first == ["x/api": ["a", "b"]])
        #expect(failed?.problem != nil)
        #expect(failing == first)
        #expect(sut.interfaces.map(\.owner) == ["a"])
        #expect(loading == first)
    }

    @Test("a provider found with a problem keeps its place and its pin, and leaves the queue once it is removed")
    func providerWithProblemKeepsPlace() throws {
        // Given
        try write("a", in: source, provides: ["x/api": [1]])
        try write("b", in: source, provides: ["x/api": [1]])
        try write("c", in: source, provides: ["x/api": [1]])
        let settings = home.appending(path: "deck.json")
        let sut = try catalog(sources: [source])
        _ = sut.read()
        try sut.pin("x/api", to: "b")
        let first = queues(of: sut)
        let kept = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: settings))

        // When
        try Data("id = ".utf8).write(to: source.appending(path: "b/manifest.toml"))
        try write("c", in: source, contributes: "[]", provides: ["x/api": [1]])
        let problems = sut.read().filter { mod in mod.problem != nil }.map(\.manifest.id)
        let broken = queues(of: sut)
        let brokenOwner = sut.interfaces.map { queue in (queue.owner, queue.pinned) }
        let keptBroken = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: settings))
        try write("b", in: source, provides: ["x/api": [1]])
        try write("c", in: source, provides: ["x/api": [1]])
        let read = queues(of: sut)
        try FileManager.default.removeItem(at: source.appending(path: "b"))
        let removed = queues(of: sut)
        let removedOwner = sut.interfaces.map { queue in (queue.owner, queue.pinned) }

        // Then
        #expect(first == ["x/api": ["a", "b", "c"]])
        #expect(problems == ["b", "c"])
        #expect(broken == first)
        #expect(brokenOwner.map(\.0) == ["b"] && brokenOwner.map(\.1) == [true])
        #expect(keptBroken == kept)
        #expect(read == first)
        #expect(removed == ["x/api": ["a", "c"]])
        #expect(removedOwner.map(\.0) == ["a"] && removedOwner.map(\.1) == [false])
    }

    @Test("while a mod found names no id, the ids not found keep their places and pins, and leave once all are known")
    func unnamedModKeepsIdsNotFound() throws {
        // Given
        try write("a", in: source, provides: ["x/api": [1]])
        try write("foo", in: source, folder: "foo-dev", provides: ["x/api": [1]])
        let settings = home.appending(path: "deck.json")
        let sut = try catalog(sources: [source])
        _ = sut.read()
        try sut.pin("x/api", to: "foo")
        let first = queues(of: sut)
        let kept = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: settings))

        // When
        try Data("id = ".utf8).write(to: source.appending(path: "foo-dev/manifest.toml"))
        try FileManager.default.removeItem(at: source.appending(path: "a"))
        let broken = queues(of: sut)
        let brokenOwner = sut.interfaces.map { queue in (queue.owner, queue.pinned) }
        let keptBroken = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: settings))
        try write("foo", in: source, folder: "foo-dev", provides: ["x/api": [1]])
        let read = queues(of: sut)
        let readOwner = sut.interfaces.map { queue in (queue.owner, queue.pinned) }

        // Then
        #expect(first == ["x/api": ["a", "foo"]])
        #expect(broken == ["x/api": ["a", "foo"]])
        #expect(brokenOwner.map(\.0) == ["foo"] && brokenOwner.map(\.1) == [true])
        #expect(keptBroken == kept)
        #expect(read == ["x/api": ["foo"]])
        #expect(readOwner.map(\.0) == ["foo"] && readOwner.map(\.1) == [true])
    }

    @Test("a mod removed leaves its queues while a mod found names no id, and the next provider owns the interface")
    func removedModLeavesQueues() throws {
        // Given
        try write("a", in: home.appending(path: "mods"), provides: ["x/api": [1]])
        try write("b", in: home.appending(path: "mods"), provides: ["x/api": [1]])
        let sut = try catalog(sources: [source])
        let first = queues(of: sut)
        try FileManager.default.createDirectory(at: source.appending(path: "foo-dev"), withIntermediateDirectories: true)
        try Data("id = ".utf8).write(to: source.appending(path: "foo-dev/manifest.toml"))

        // When
        _ = try sut.remove("a")
        let removed = queues(of: sut)

        // Then
        #expect(first == ["x/api": ["a", "b"]])
        #expect(removed == ["x/api": ["b"]])
        #expect(sut.owner(of: "x/api") == "b")
    }

    @Test("an owner kept and not found is listed as a provider not found, and a mod that uses it is told so")
    func ownerNotFoundIsListed() throws {
        // Given
        try write("a", in: source, provides: ["x/api": [1]])
        try write("b", in: source, uses: ["x/api": 1])
        let sut = try catalog(sources: [source])
        _ = sut.read()
        try FileManager.default.removeItem(at: source.appending(path: "a"))
        try FileManager.default.createDirectory(at: source.appending(path: "foo-dev"), withIntermediateDirectories: true)
        try Data("id = ".utf8).write(to: source.appending(path: "foo-dev/manifest.toml"))

        // When
        let uses = sut.read().first { mod in mod.manifest.id == "b" }?.uses
        let queue = sut.interfaces.first { queue in queue.interface == "x/api" }

        // Then
        #expect(queue?.owner == "a")
        #expect(queue?.providers == [InterfaceProvider(id: "a", name: nil, majors: [], pinnable: false)])
        #expect(
            uses == [
                InterfaceUse(
                    interface: "x/api",
                    major: 1,
                    owner: "a",
                    name: nil,
                    problem: "uses x/api 1, and its owner a is not found, so it reaches no one by it"
                )
            ]
        )
    }

    @Test("a pinned provider owns an interface until the pin is cleared or it leaves the queue, and only a provider is")
    func pinnedProviderOwns() throws {
        // Given
        try write("a", in: source, provides: ["x/api": [1]])
        try write("b", in: source, provides: ["x/api": [2]])
        try write("c", in: source)
        let settings = home.appending(path: "deck.json")
        let sut = try catalog(sources: [source])
        _ = sut.read()

        // When
        try sut.pin("x/api", to: "b")
        let unread = sut.interfaces
        _ = sut.read()
        let pinned = sut.interfaces
        let notProvider = Result { try sut.pin("x/api", to: "c") }
        let noInterface = Result { try sut.pin("y/api", to: "a") }
        try sut.pin("x/api", to: nil)
        _ = sut.read()
        let cleared = sut.interfaces
        try sut.pin("x/api", to: "b")
        try FileManager.default.removeItem(at: source.appending(path: "b"))
        _ = sut.read()
        let left = sut.interfaces
        let kept = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: settings))

        // Then
        let a = InterfaceProvider(id: "a", name: "a", majors: [1], pinnable: true)
        let b = InterfaceProvider(id: "b", name: "b", majors: [2], pinnable: true)
        #expect(unread == [InterfaceQueue(interface: "x/api", name: nil, owner: "a", pinned: false, providers: [a, b])])
        #expect(pinned == [InterfaceQueue(interface: "x/api", name: nil, owner: "b", pinned: true, providers: [a, b])])
        #expect(throws: PinError.notProvider(interface: "x/api", mod: "c")) { try notProvider.get() }
        #expect(throws: PinError.notProvider(interface: "y/api", mod: "a")) { try noInterface.get() }
        #expect(cleared == unread)
        #expect(left == [InterfaceQueue(interface: "x/api", name: nil, owner: "a", pinned: false, providers: [a])])
        #expect(kept == .object(["providers": .object(["x/api": .array([.string("a")])]), "pins": .object([:])]))
    }

    @Test("a provider kept with a problem is not pinnable and is refused a pin, and keeps the pin it holds")
    func providerWithProblemIsNotPinned() throws {
        // Given
        try write("a", in: source, provides: ["x/api": [1]])
        try write("b", in: source, provides: ["x/api": [1]])
        try write("c", in: source, provides: ["x/api": [1]])
        let sut = try catalog(sources: [source])
        _ = sut.read()
        try sut.pin("x/api", to: "b")

        // When
        try Data("id = ".utf8).write(to: source.appending(path: "b/manifest.toml"))
        try write("c", in: source, contributes: "[]", provides: ["x/api": [1]])
        _ = sut.read()
        let pinnable = sut.interfaces.flatMap(\.providers).map { provider in (provider.id, provider.pinnable) }
        let other = Result { try sut.pin("x/api", to: "c") }
        let again = Result { try sut.pin("x/api", to: "b") }
        _ = sut.read()
        let owner = sut.interfaces.map { queue in (queue.owner, queue.pinned) }

        // Then
        #expect(pinnable.map(\.0) == ["a", "b", "c"] && pinnable.map(\.1) == [true, false, false])
        #expect(throws: PinError.notProvider(interface: "x/api", mod: "c")) { try other.get() }
        #expect(throws: PinError.notProvider(interface: "x/api", mod: "b")) { try again.get() }
        #expect(owner.map(\.0) == ["b"] && owner.map(\.1) == [true])
    }

    @Test("an interface a mod uses comes to its owner, with a problem when it does not provide that major, and to none")
    func useComesToItsOwner() throws {
        // Given
        try write("x", in: source, provides: ["x/api": [2, 3]], uses: ["x/api": 2])
        try write("a", in: source, uses: ["x/api": 1])
        try write("b", in: source, uses: ["x/api": 2])
        try write("c", in: source, uses: ["y/api": 1])
        let sut = try catalog(sources: [source])

        // When
        let uses = Dictionary(uniqueKeysWithValues: sut.read().map { mod in (mod.manifest.id, mod.uses) })

        // Then
        #expect(
            uses == [
                "a": [
                    InterfaceUse(
                        interface: "x/api",
                        major: 1,
                        owner: "x",
                        name: "x",
                        problem: "uses x/api 1, and its owner x provides it at 2, 3, so it reaches no one by it"
                    )
                ],
                "b": [InterfaceUse(interface: "x/api", major: 2, owner: "x", name: "x", problem: nil)],
                "c": [InterfaceUse(interface: "y/api", major: 1, owner: nil, name: nil, problem: nil)],
                "x": [InterfaceUse(interface: "x/api", major: 2, owner: nil, name: nil, problem: nil)]
            ]
        )
    }

    // MARK: - Private
    private func catalog(sources: [URL] = [], ship: [URL] = []) throws -> Catalog {
        let store = Store()
        let reader = try ManifestReader(
            api: try #require(Version("1.0.0")),
            permissions: [],
            fields: [],
            store: store
        )
        let modFolder = ModFolder(reader: reader, store: store)
        let folder = home.appending(path: "mods")
        return Catalog(
            folder: folder,
            sources: sources,
            ship: ship,
            modFolder: modFolder,
            dataFolder: DataFolder(folder: home.appending(path: "data"), store: store),
            installer: Installer(home: home, folder: folder, ship: ship, modFolder: modFolder, store: store),
            order: Order(file: home.appending(path: "deck.json"), store: store),
            ownershipStore: OwnershipStore(file: home.appending(path: "deck.json"), store: store),
            startupList: StartupList(file: home.appending(path: "deck.json"), store: store),
            store: store
        )
    }

    // Interface -> the ids of its providers, the earliest first, as `catalog` reads the mods again.
    private func queues(of catalog: Catalog) -> [String: [String]] {
        _ = catalog.read()

        return Dictionary(uniqueKeysWithValues: catalog.interfaces.map { queue in
            (queue.interface, queue.providers.map(\.id))
        })
    }

    private func write(
        _ id: String,
        in parent: URL,
        folder: String? = nil,
        version: String = "1.0.0",
        main: String? = "main.js",
        contributes: String? = nil,
        startup: String? = nil,
        provides: [String: [Int]] = [:],
        uses: [String: Int] = [:],
        requires: [String: String] = [:],
        optional: [String: String] = [:]
    ) throws {
        let location = parent.appending(path: folder ?? id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let dependencies = requires.map { other, want in "\(other) = \"\(want)\"" }
            + optional.map { other, want in "\(other) = { version = \"\(want)\", optional = true }" }
        let relations = dependencies.isEmpty ? "" : "\n[dependencies]\n" + dependencies.joined(separator: "\n")
        let provided = provides.sorted { one, other in one.key < other.key }.map { interface, majors in
            "\"\(interface)\" = [" + majors.map(String.init).joined(separator: ", ") + "]"
        }
        let used = uses.sorted { one, other in one.key < other.key }.map { interface, major in
            "\"\(interface)\" = \(major)"
        }
        let interfaces = provided.isEmpty && used.isEmpty
            ? ""
            : "\n[interfaces]"
                + (provided.isEmpty ? "" : "\nprovides = { " + provided.joined(separator: ", ") + " }")
                + (used.isEmpty ? "" : "\nuses = { " + used.joined(separator: ", ") + " }")
        let text = """
            id = "\(id)"
            version = "\(version)"
            api = "1.0.0"
            main = "\(main ?? "missing.js")"
            """ + (contributes == nil ? "" : "\ncontributes = \"contributes.json\"")
            + (startup.map { reason in "\nstartup = \"\(reason)\"" } ?? "") + relations + interfaces
        try Data(text.utf8).write(to: location.appending(path: "manifest.toml"))
        if let contributes {
            try Data(contributes.utf8).write(to: location.appending(path: "contributes.json"))
        }
        if let main {
            try Data().write(to: location.appending(path: main))
        }
    }
}
