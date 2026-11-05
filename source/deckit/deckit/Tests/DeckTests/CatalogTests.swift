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

    @Test("a cycle fails every mod in it, and a failure spreads to whoever requires it")
    func requirementsFail() throws {
        // Given
        try write("a", in: source, implements: ["a/api": "1.0.0"], requires: ["b/api": "1.0.0"])
        try write("b", in: source, implements: ["b/api": "1.0.0"], requires: ["a/api": "1.0.0"])
        try write("c", in: source, requires: ["a/api": "1.0.0"])
        try write("d", in: source, requires: ["e/api": "2.0.0"])
        try write("e", in: source, implements: ["e/api": "1.0.0"])
        let sut = try catalog(sources: [source])

        // When
        let problems = Dictionary(uniqueKeysWithValues: sut.mods().map { mod in (mod.manifest.id, mod.problem) })

        // Then
        #expect(problems["a"] == "requires itself: a → b → a")
        #expect(problems["b"] == "requires itself: a → b → a")
        #expect(problems["c"] == "needs a/api, which a implements and did not load")
        #expect(problems["d"] == "needs e/api 2.0.0, and e implements it at 1.0.0")
        #expect(problems["e"] == .some(nil))
    }

    @Test("a relation says why it is not there at the version named, an optional one only of a version not satisfied")
    func relationSaysWhy() throws {
        // Given
        try write("x", in: source, implements: ["x/api": "1.2.0"])
        try write("y", in: source, requires: ["x/api": "2.0.0"], optional: ["v/api": "1.0.0"])
        try write("z", in: source, optional: ["x/api": "2.0.0"])
        let sut = try catalog(sources: [source])

        // When
        let problems = Dictionary(
            uniqueKeysWithValues: sut.mods().flatMap { mod in
                mod.relations.map { relation in ("\(mod.manifest.id) \(relation.interface)", relation.problem) }
            }
        )

        // Then
        #expect(
            problems == [
                "y x/api": "needs x/api 2.0.0, and x implements it at 1.2.0",
                "y v/api": nil,
                "z x/api": "uses x/api 2.0.0, and x implements it at 1.2.0, so it runs without it",
            ]
        )
    }

    @Test("a mod lists the mods that load and require it, directly or through another")
    func dependentsReachThrough() throws {
        // Given
        try write("x", in: source, implements: ["x/api": "1.0.0"])
        try write("y", in: source, implements: ["y/api": "1.0.0"], requires: ["x/api": "1.0.0"])
        try write("z", in: source, requires: ["y/api": "1.0.0"])
        try write("w", in: source, requires: ["x/api": "1.0.0", "v/api": "1.0.0"])
        let sut = try catalog(sources: [source])

        // When
        let dependents = Dictionary(uniqueKeysWithValues: sut.mods().map { mod in (mod.manifest.id, mod.dependents) })

        // Then
        #expect(dependents == ["x": ["y", "z"], "y": ["z"], "z": [], "w": []])
    }

    @Test("each loads after what it requires, otherwise where the load order kept places it, which reading leaves")
    func loadOrderPutsRequirementsFirst() throws {
        // Given
        try write("a", in: source, implements: ["a/api": "1.0.0"])
        try write("b", in: source, requires: ["a/api": "1.0.0"])
        try write("c", in: source)
        try write("d", in: source, main: nil)
        let settings = home.appending(path: "deck.json")
        try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
        try Data(#"{"loadOrder":["c","b","a"],"other":1}"#.utf8).write(to: settings)
        let sut = try catalog(sources: [source])

        // When
        let mods = sut.read()

        // Then
        #expect(mods.map(\.manifest.id) == ["c", "a", "b", "d"])
        #expect(try String(contentsOf: settings, encoding: .utf8) == #"{"loadOrder":["c","b","a"],"other":1}"#)
    }

    @Test("installing keeps the load order as the mods come: one installed takes its place, one removed leaves")
    func installKeepsLoadOrder() throws {
        // Given
        try write("a", in: home.appending(path: "mods"))
        try write("c", in: home.appending(path: "mods"))
        try write("b", in: source)
        let settings = home.appending(path: "deck.json")
        try Data(#"{"loadOrder":["c","a"],"other":1}"#.utf8).write(to: settings)
        let sut = try catalog()

        // When
        _ = try sut.install(from: source.appending(path: "b"))
        let installed = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: settings))
        _ = try sut.remove("a")
        let removed = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: settings))

        // Then
        #expect(installed == .object(["loadOrder": .array(["c", "a", "b"].map(JSONValue.string)), "other": .number(1)]))
        #expect(removed == .object(["loadOrder": .array(["c", "b"].map(JSONValue.string)), "other": .number(1)]))
    }

    @Test("one that does not load keeps its place, and one it requires found anew goes just before it")
    func failedModKeepsItsPlace() throws {
        // Given
        try write("a", in: source)
        try write("x", in: source, requires: ["y/api": "1.0.0"])
        try write("b", in: source)
        try write("y", in: source, implements: ["y/api": "1.0.0"])
        let sut = try catalog(sources: [source])
        try sut.arrange(["a", "y", "x", "b"])
        try FileManager.default.removeItem(at: source.appending(path: "y"))

        // When
        let failed = sut.read()
        try write("y", in: source, implements: ["y/api": "1.0.0"])
        let back = sut.read()

        // Then
        #expect(failed.map(\.manifest.id) == ["a", "x", "b"])
        #expect(failed.map(\.problem) == [nil, "needs y/api, and no implementation of it is on", nil])
        #expect(back.map(\.manifest.id) == ["a", "y", "x", "b"])
        #expect(back.allSatisfy { mod in mod.problem == nil })
    }

    @Test("arranging moves the ids named among the places they held, refusing one that loads before what it requires")
    func arrangeKeepsRequirementsFirst() throws {
        // Given
        for id in ["c", "d"] {
            try write(id, in: source)
        }
        try write("a", in: source, implements: ["a/api": "1.0.0"])
        try write("b", in: source, requires: ["a/api": "1.0.0"])
        try write("e", in: source, implements: ["e/api": "1.0.0"], requires: ["f/api": "1.0.0"])
        try write("f", in: source, implements: ["f/api": "1.0.0"], requires: ["e/api": "1.0.0"])
        try write("g", in: source, optional: ["h/api": "1.0.0"])
        try write("h", in: source, implements: ["h/api": "1.0.0"])
        let sut = try catalog(sources: [source])

        // When
        try sut.arrange(["d", "f", "c", "x", "d", "e", "g", "h"])
        let arranged = sut.mods().map(\.manifest.id)
        let refused = Result { try sut.arrange(["b", "a"]) }

        // Then
        #expect(arranged == ["a", "b", "d", "f", "c", "e", "g", "h"])
        #expect(throws: LoadOrderError.requiredLater(mod: "b", requirement: "a")) { try refused.get() }
        #expect(sut.mods().map(\.manifest.id) == arranged)
    }

    @Test("a settings file that does not read as a JSON object is neither read for an order nor written over")
    func unreadableSettingsStay() throws {
        // Given
        try write("b", in: source)
        try write("a", in: source)
        let settings = home.appending(path: "deck.json")
        try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
        try Data(#"{"loadOrder":["b","a"],"#.utf8).write(to: settings)
        let sut = try catalog(sources: [source])

        // When
        let mods = sut.read()
        let refused = Result { try sut.arrange(["b", "a"]) }

        // Then
        #expect(mods.map(\.manifest.id) == ["a", "b"])
        #expect(throws: DeckSettingsError.unreadable("deck.json")) { try refused.get() }
        #expect(try String(contentsOf: settings, encoding: .utf8) == #"{"loadOrder":["b","a"],"#)
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

    @Test("installing what the app ships places what the load order did not, and every place kept stays")
    func installShippedKeepsLoadOrder() throws {
        // Given
        try write("x", in: source)
        try write("a", in: ship, implements: ["a/api": "1.0.0"])
        try write("b", in: ship, requires: ["a/api": "1.0.0"])
        let settings = home.appending(path: "deck.json")
        try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
        try Data(#"{"loadOrder":["x","gone","b"]}"#.utf8).write(to: settings)
        let sut = try catalog(sources: [source], ship: [ship.appending(path: "a"), ship.appending(path: "b")])

        // When
        _ = try sut.installShipped()

        // Then
        let kept = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: settings))
        #expect(kept == .object(["loadOrder": .array(["x", "gone", "a", "b"].map(JSONValue.string))]))
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

    @Test("ordering an interface's list keeps the person's order and switches, refusing an interface with no list")
    func orderKeepsThePersonsList() throws {
        // Given
        for id in ["a", "b", "c"] {
            try write(id, in: source, implements: ["x/api": "1.0.0"])
        }
        let sut = try catalog(sources: [source], implementations: ["x/api": ["b"]])

        // When
        try sut.order("x/api", order: ["c", "b"], off: ["b"])
        _ = sut.read()
        let refused = Result { try sut.order("x/none", order: [], off: []) }

        // Then
        let list = try #require(sut.interfaces.first)
        #expect(list.implementations.map(\.id) == ["c", "b", "a"])
        #expect(list.implementations.map(\.on) == [true, false, true])
        #expect(sut.pick(of: "x/api") == "c")
        #expect(throws: LoadOrderError.noInterface("x/none")) { try refused.get() }
    }

    @Test("an order whose pick would make a cycle of mods that load now is refused, and nothing is kept")
    func orderRefusesACycle() throws {
        // Given
        try write("a", in: source, implements: ["x/one": "1.0.0"], requires: ["x/two": "1.0.0"])
        try write("b", in: source, implements: ["x/two": "1.0.0"])
        try write("c", in: source, implements: ["x/two": "1.0.0"], requires: ["x/one": "1.0.0"])
        let sut = try catalog(sources: [source])

        // When
        let refused = Result { try sut.order("x/two", order: ["c"], off: []) }
        _ = sut.read()

        // Then
        #expect(throws: LoadOrderError.cycle(["a", "c", "a"])) { try refused.get() }
        #expect(sut.pick(of: "x/two") == "b")
        #expect(!FileManager.default.fileExists(atPath: home.appending(path: "deck.json").path(percentEncoded: false)))
    }

    @Test("a pick the load order places after a mod that requires it loads just before that mod")
    func orderLoadsAPickBeforeItsDependent() throws {
        // Given
        try write("a", in: source, requires: ["x/api": "1.0.0"])
        try write("b", in: source, implements: ["x/api": "1.0.0"])
        try write("z", in: source, implements: ["x/api": "1.0.0"])
        let sut = try catalog(sources: [source])

        // When
        try sut.order("x/api", order: ["z"], off: [])
        let mods = sut.read()

        // Then
        #expect(sut.pick(of: "x/api") == "z")
        #expect(mods.map(\.manifest.id) == ["z", "a", "b"])
        #expect(mods.allSatisfy { mod in mod.problem == nil })
    }

    @Test("what the person set of a mod stays while it is off the list for a while, and goes once it is removed")
    func orderOutlivesAbsenceNotRemoval() throws {
        // Given
        let mods = home.appending(path: "mods")
        try write("a", in: mods, implements: ["x/api": "1.0.0"])
        try write("b", in: mods, implements: ["x/api": "1.0.0"])
        let settings = home.appending(path: "deck.json")
        let sut = try catalog()
        try sut.order("x/api", order: ["b", "a"], off: ["a"])
        try FileManager.default.removeItem(at: mods.appending(path: "a"))

        // When
        _ = sut.read()
        let absent = sut.interfaces.first?.implementations.map(\.id)
        try sut.order("x/api", order: ["b"], off: [])
        try write("a", in: mods, implements: ["x/api": "1.0.0"])
        _ = sut.read()
        let back = try #require(sut.interfaces.first)
        _ = try sut.remove("a")
        let removed = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: settings))

        // Then
        #expect(absent == ["b"])
        #expect(back.implementations.map(\.id) == ["b", "a"])
        #expect(back.implementations.map(\.on) == [true, false])
        #expect(
            removed == .object([
                "implementations": .object([
                    "x/api": .object(["order": .array([.string("b")]), "off": .array([])])
                ])
            ])
        )
    }

    // MARK: - Private
    private func catalog(
        sources: [URL] = [],
        ship: [URL] = [],
        implementations: [String: [String]] = [:]
    ) throws -> Catalog {
        let store = Store()
        let reader = try ManifestReader(
            api: try #require(Version("1.0.0")),
            permissions: [],
            fields: [],
            store: store
        )
        let modFolder = ModFolder(reader: reader, store: store)
        let folder = home.appending(path: "mods")
        let settings = home.appending(path: "deck.json")
        return Catalog(
            folder: folder,
            sources: sources,
            ship: ship,
            modFolder: modFolder,
            dataFolder: DataFolder(folder: home.appending(path: "data"), store: store),
            installer: Installer(home: home, folder: folder, ship: ship, modFolder: modFolder, store: store),
            loadOrder: LoadOrder(file: settings, store: store),
            implementationOrder: ImplementationOrder(file: settings, store: store),
            implementations: implementations,
            store: store
        )
    }

    private func write(
        _ id: String,
        in parent: URL,
        folder: String? = nil,
        version: String = "1.0.0",
        main: String? = "main.js",
        implements: [String: String] = [:],
        requires: [String: String] = [:],
        optional: [String: String] = [:]
    ) throws {
        let location = parent.appending(path: folder ?? id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let implemented = implements.map { interface, version in "\"\(interface)\" = \"\(version)\"" }
        let dependencies = requires.map { interface, want in "\"\(interface)\" = \"\(want)\"" }
            + optional.map { interface, want in "\"\(interface)\" = { version = \"\(want)\", optional = true }" }
        let text = """
            id = "\(id)"
            version = "\(version)"
            api = "1.0.0"
            main = "\(main ?? "missing.js")"
            """
            + (implemented.isEmpty ? "" : "\n[implements]\n" + implemented.joined(separator: "\n"))
            + (dependencies.isEmpty ? "" : "\n[dependencies]\n" + dependencies.joined(separator: "\n"))
        try Data(text.utf8).write(to: location.appending(path: "manifest.toml"))
        if let main {
            try Data().write(to: location.appending(path: main))
        }
    }
}
