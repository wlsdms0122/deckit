//
//  CatalogTests.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

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
    @Test("each comes in the order it was installed, then by id, whether it loads or not")
    func modsComeInOrder() throws {
        // Given
        try write("c", in: home.appending(path: "mods"))
        try write("b", in: home.appending(path: "mods"))
        try write("a", in: home.appending(path: "mods"))
        try write("d", in: home.appending(path: "mods"), main: nil)
        try write("e", in: ship)
        let sut = try catalog(ship: ["e"])
        _ = try sut.installShipped()

        // When
        let mods = sut.mods()

        // Then
        #expect(mods.map(\.manifest.id) == ["e", "a", "b", "c", "d"])
        #expect(
            mods.last?.problem as? ModFolderError
                == .notLoadable(#"main = "missing.js" names no file in the mod's folder"#)
        )
    }

    @Test("what a mod's [contributes] declares is carried as written, and one of another shape fails it")
    func contributesAreCarried() throws {
        // Given
        try write("a", in: source, contributes: "[[contributes.\"x/api\"]]\ntitle = \"Open\"\nsize = 2")
        try write("b", in: source, contributes: "[contributes]\n\"x/api\" = 1")
        try write("c", in: source)
        let sut = try catalog(sources: [source])

        // When
        let mods = sut.mods()

        // Then
        #expect(mods[0].manifest.contributes == ["x/api": [.object(["title": .string("Open"), "size": .number(2)])]])
        #expect(mods[0].problem == nil)
        #expect(
            mods[1].problem as? ModFolderError
                == .notLoadable(#"contributes x/api must be a list of tables, as [[contributes."other/name"]] tables"#)
        )
        #expect(mods[2].manifest.contributes.isEmpty)
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

    @Test("installing keeps the install order: one installed again keeps its place, one removed leaves it")
    func installKeepsOrder() throws {
        // Given
        for id in ["a", "b", "c"] {
            try write(id, in: source)
        }
        try write("d", in: root.appending(path: "place"))
        let sut = try catalog(sources: [root.appending(path: "place")])

        // When
        for id in ["c", "a", "b", "c"] {
            _ = try sut.install(from: source.appending(path: id))
        }
        let installed = sut.mods().map(\.manifest.id)
        _ = try sut.remove("a")
        _ = try sut.install(from: source.appending(path: "a"))
        let again = sut.mods().map(\.manifest.id)

        // Then
        #expect(installed == ["c", "a", "b", "d"])
        #expect(again == ["c", "b", "a", "d"])
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

    @Test("what the app ships is installed in the order it ships it, after what was installed before")
    func installShippedKeepsOrder() throws {
        // Given
        try write("x", in: source)
        try write("b", in: ship)
        try write("a", in: ship)
        let sut = try catalog(ship: ["b", "a"])
        _ = try sut.install(from: source.appending(path: "x"))

        // When
        _ = try sut.installShipped()

        // Then
        #expect(sut.mods().map(\.manifest.id) == ["x", "b", "a"])
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
        #expect(throws: ModFolderError.notLoadable(#"main = "missing.js" names no file in the mod's folder"#)) {
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
        let shipped = ["a", "b"]
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
        #expect(
            mods.map { mod in mod.problem as? ModFolderError }
                == [.notLoadable(#"main = "missing.js" names no file in the mod's folder"#)]
        )
    }

    @Test("a mod the app ships that the host names a system mod is one across starts, and a copy from a folder is not")
    func systemModIsRecorded() throws {
        // Given
        try write("s", in: ship)
        try write("p", in: ship)
        try write("s", in: source)
        let sut = try catalog(ship: ["s", "p"], system: ["s"])
        _ = try sut.installShipped()

        // When
        let installed = sut.mods()
        let restarted = try catalog(ship: ["s", "p"], system: ["s"])
        let kept = restarted.mods()
        _ = try restarted.install(from: source.appending(path: "s"))
        let replaced = restarted.mods()

        // Then
        #expect(installed.map(\.manifest.id) == ["s", "p"])
        #expect(installed.map(\.system) == [true, false])
        #expect(kept.map(\.system) == [true, false])
        #expect(replaced.map(\.system) == [false, false])
    }

    @Test("a privileged permission is granted to a system mod, and a mod that is none asking for it does not get in")
    func privilegedPermissionIsForSystemMods() throws {
        // Given
        let any = Permission(id: "deckit.any", name: "Any", description: "Any mod.", privileged: true)
        try write("s", in: ship, permissions: ["deckit.any"])
        try write("n", in: ship, permissions: ["deckit.any"])
        try write("r", in: source, permissions: ["deckit.any"])
        try write("f", in: root, permissions: ["deckit.any"])
        let sut = try catalog(sources: [source], ship: ["s", "n"], system: ["s"], permissions: [any])
        let problem = #"permission "deckit.any" is granted only to a system mod"#

        // When
        let outcomes = try sut.installShipped()
        let installing = Result { try sut.planInstall(from: root.appending(path: "f")) }
        let mods = Dictionary(uniqueKeysWithValues: sut.read().map { mod in (mod.manifest.id, mod) })

        // Then
        #expect(outcomes.map(\.outcome) == [.installed, .failed])
        #expect(throws: ModFolderError.notLoadable(problem)) { try installing.get() }
        #expect(mods["s"]?.problem == nil)
        #expect(mods["s"].flatMap(Job.init)?.permissions == ["deckit.any"])
        #expect(mods["n"]?.problem as? ModFolderError == .notLoadable(problem))
        #expect(mods["r"]?.problem as? ModFolderError == .notLoadable(problem))
    }

    @Test("the plan answers the permissions and background installing consents to, and a job has those defined here")
    func installIsConsent() throws {
        // Given
        let mods = Permission(id: "deckit.mods", name: "Mods", description: "Every mod.")
        try write("a", in: source, background: "Runs a service", permissions: ["deckit.mods", "system.camera"])
        let sut = try catalog(permissions: [mods])

        // When
        let plan = try sut.planInstall(from: source.appending(path: "a"))
        _ = try sut.install(from: source.appending(path: "a"))
        let job = try #require(sut.read().first.flatMap(Job.init))

        // Then
        #expect(plan.manifest.background == "Runs a service")
        #expect(plan.manifest.permissions.map(\.id) == ["deckit.mods", "system.camera"])
        #expect(plan.manifest.permissions.map(\.usable) == [true, false])
        #expect(job.permissions == ["deckit.mods"])
    }

    @Test("what the app ships that fails to install says why, and is no installed mod")
    func shippedFailedIsNotInstalled() throws {
        // Given
        try write("b", in: ship, main: nil)
        try write("b", in: source)
        let sut = try catalog(ship: ["b"])

        // When
        _ = try sut.installShipped()
        let mods = sut.mods()
        let installing = try sut.planInstall(from: source.appending(path: "b"))
        let removed = Result { try sut.remove("b") }

        // Then
        #expect(
            mods.map { mod in mod.problem as? ModFolderError }
                == [.notLoadable(#"main = "missing.js" names no file in the mod's folder"#)]
        )
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

    @Test("providers arriving at once queue in install order, then by id, and a mod that does not load is none")
    func queueTiesComeInInstallOrder() throws {
        // Given
        try write("b", in: source, provides: ["x/api": [1]])
        try write("a", in: source, provides: ["x/api": [1]])
        try write("f", in: source, main: nil, provides: ["x/api": [1]])
        try write("s", in: ship, provides: ["x/api": [1]])
        let sut = try catalog(sources: [source], ship: ["s"])
        _ = try sut.installShipped()

        // When
        let queues = queues(of: sut)

        // Then
        #expect(queues == ["x/api": ["s", "a", "b"]])
        #expect(sut.interfaces.map(\.owner) == ["s"])
    }

    @Test("a provider that does not load for a file it names keeps its place in the queue, and still owns")
    func providerFailingByFileKeepsPlace() throws {
        // Given
        try write("a", in: source, provides: ["x/api": [1]])
        try write("b", in: source, provides: ["x/api": [1]])
        let sut = try catalog(sources: [source])
        let first = queues(of: sut)

        // When
        try write("a", in: source, main: nil, provides: ["x/api": [1]])
        let failing = queues(of: sut)
        let failed = sut.read().first { mod in mod.manifest.id == "a" }
        try write("a", in: source, provides: ["x/api": [1]])
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
        try write("c", in: source, contributes: "[contributes]\nx = 1", provides: ["x/api": [1]])
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
        #expect(sut.interfaces.first { queue in queue.interface == "x/api" }?.owner == "b")
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
        try write("c", in: source, contributes: "[contributes]\nx = 1", provides: ["x/api": [1]])
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
    // `ship` names the mods the app ships from the ship folder, those in `system` named system mods.
    private func catalog(
        sources: [URL] = [],
        ship: [String] = [],
        system: Set<String> = [],
        permissions: [Permission] = []
    ) throws -> Catalog {
        let store = Store()
        let reader = try ManifestReader(
            api: try #require(Version("1.0.0")),
            permissions: permissions,
            fields: [],
            store: store
        )
        let modFolder = ModFolder(reader: reader, store: store)
        let folder = home.appending(path: "mods")
        return Catalog(
            folder: folder,
            sources: sources,
            modFolder: modFolder,
            dataFolder: DataFolder(folder: home.appending(path: "data"), store: store),
            installer: Installer(
                home: home,
                folder: folder,
                ship: ship.map { id in ShippedMod(folder: self.ship.appending(path: id), system: system.contains(id)) },
                modFolder: modFolder,
                store: store
            ),
            ownerTable: Deck(home: home).owners,
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
        background: String? = nil,
        permissions: [String] = [],
        provides: [String: [Int]] = [:],
        uses: [String: Int] = [:]
    ) throws {
        let location = parent.appending(path: folder ?? id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let provided = provides.sorted { one, other in one.key < other.key }.map { interface, majors in
            "\"\(interface)\" = [" + majors.map(String.init).joined(separator: ", ") + "]"
        }
        let used = uses.sorted { one, other in one.key < other.key }.map { interface, major in
            "\"\(interface)\" = \(major)"
        }
        let asked = permissions.isEmpty
            ? ""
            : "\n[permissions]" + permissions.map { permission in "\n\"\(permission)\" = \"to test\"" }.joined()
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
            """ + (background.map { reason in "\nbackground = \"\(reason)\"" } ?? "") + asked + interfaces
            + (contributes.map { contributes in "\n" + contributes } ?? "")
        try Data(text.utf8).write(to: location.appending(path: "manifest.toml"))
        if let main {
            try Data().write(to: location.appending(path: main))
        }
    }
}
