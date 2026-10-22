//
//  RunnerTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("Runner")
struct RunnerTests {
    // MARK: - Property
    private let root: URL
    private let home: URL
    private let source: URL

    // MARK: - Initializer
    init() {
        root = FileManager.default.temporaryDirectory.appending(path: "runner-tests-\(UUID().uuidString)")
        home = root.appending(path: "home")
        source = root.appending(path: "source")
    }

    // MARK: - Test
    @Test("each mod that loads opens, launches and loads its page, in the load order")
    func reconcileOpensEachMod() throws {
        // Given
        try write("a")
        try write("b", main: nil)
        let (sut, catalog) = try runner()

        // When
        _ = catalog.read()
        let effects = try sut.reconcile()

        // Then
        #expect(describe(effects) == ["open a", "tell willLaunch a 1 launching", "load a"])
    }

    @Test("a run launches once its page says it started, and what an older run says is not the newer one's")
    func startedLaunchesTheLatestRun() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()

        // When
        let stale = try sut.started("a", run: 2)
        let effects = try sut.started("a", run: 1)

        // Then
        #expect(stale.isEmpty)
        #expect(describe(effects) == ["tell didLaunch a 1 running"])
    }

    @Test("a mod terminates before what it requires, whose stop() is asked once it has ended; that one launches again")
    func dependentsEndFirst() throws {
        // Given
        try write("a")
        try write("b", requires: ["a": "1.0.0"])
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)
        _ = try sut.started("b", run: 1)

        // When
        let relaunched = try sut.relaunch("a")
        let dependentStopped = try sut.stopped("b", run: 1)
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(
            describe(relaunched) == [
                "tell willTerminate a 1 terminating relaunch",
                "tell willTerminate b 1 terminating requirement",
                "stop b 1"
            ]
        )
        #expect(describe(dependentStopped) == ["tell didTerminate b 1 notRunning requirement", "stop a 1"])
        #expect(
            describe(stopped) == [
                "tell didTerminate a 1 notRunning relaunch",
                "tell willLaunch a 2 launching",
                "load a"
            ]
        )
    }

    @Test("the mods that require one, directly or through another, and are not running launch as asked, in order")
    func dependentsLaunchAsAsked() throws {
        // Given
        try write("a")
        try write("b", requires: ["a": "1.0.0"])
        try write("c", requires: ["b": "1.0.0"])
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)
        _ = try sut.crashed("a", run: 1, problem: "its page ended (crashed)")
        _ = try sut.stopped("b", run: 1)
        _ = try sut.stopped("c", run: 1)
        _ = try sut.relaunch("a")

        // When
        let effects = try sut.launchDependents(of: "a")

        // Then
        #expect(
            describe(effects) == [
                "tell willLaunch b 2 launching",
                "load b",
                "tell willLaunch c 2 launching",
                "load c"
            ]
        )
    }

    @Test("the first problem recorded against a run is kept, and told with no step")
    func problemIsKept() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()

        // When
        let first = try sut.report("a", run: 1, problem: "a listener threw")
        let second = try sut.report("a", run: 1, problem: "another threw")

        // Then
        #expect(describe(first) == ["keep a 1 a listener threw"])
        #expect(describe(second) == ["keep a 1 a listener threw"])
    }

    @Test("a mod whose requirement crashed terminates")
    func crashEndsDependents() throws {
        // Given
        try write("a")
        try write("b", requires: ["a": "1.0.0"])
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)
        _ = try sut.started("b", run: 1)

        // When
        let effects = try sut.crashed("a", run: 1, problem: "its page ended (crashed)")

        // Then
        #expect(
            describe(effects) == [
                "tell didTerminate a 1 notRunning",
                "tell willTerminate b 1 terminating requirement",
                "stop b 1"
            ]
        )
    }

    @Test("a mod whose requirement ran again while it terminated stays down as it ends")
    func dependentStaysDownAfterItsRequirement() throws {
        // Given
        try write("a")
        try write("b", requires: ["a": "1.0.0"])
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)
        _ = try sut.started("b", run: 1)

        // When
        let loaded = try sut.loaded("a")
        let stopped = try sut.stopped("b", run: 1)

        // Then
        #expect(
            describe(loaded) == [
                "tell didTerminate a 1 notRunning",
                "tell willTerminate b 1 terminating requirement",
                "tell willLaunch a 2 launching",
                "stop b 1"
            ]
        )
        #expect(describe(stopped) == ["tell didTerminate b 1 notRunning requirement"])
    }

    @Test("a run that did not start terminates, its stop() asked, and ends once that answered")
    func failedLaunchEnds() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()

        // When
        let failed = try sut.notStarted("a", run: 1, problem: "start threw")
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(describe(failed) == ["tell didFailToLaunch a 1 terminating", "stop a 1"])
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning"])
    }

    @Test("a stronger reason given while a run terminates takes the place of the one it has")
    func strongerReasonWins() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)
        _ = try sut.relaunch("a")

        // When
        let quit = try sut.quit()
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(quit.isEmpty)
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning quit", "quit"])
    }

    @Test("relaunching every mod launches nothing while the app quits")
    func relaunchAllWaitsForTheQuit() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)
        _ = try sut.quit()

        // When
        let effects = try sut.relaunchAll()

        // Then
        #expect(effects.isEmpty)
    }

    @Test("a run that did not start launches again when it is relaunched while it terminates")
    func failedLaunchRelaunches() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.notStarted("a", run: 1, problem: "start threw")

        // When
        _ = try sut.relaunch("a")
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(
            describe(stopped) == [
                "tell didTerminate a 1 notRunning relaunch",
                "tell willLaunch a 2 launching",
                "load a"
            ]
        )
    }

    @Test("a mod whose requirement is down stays down as it ends, and does not say it launches again")
    func dependentWaitsForItsRequirement() throws {
        // Given
        try write("a")
        try write("b", requires: ["a": "1.0.0"])
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)
        _ = try sut.started("b", run: 1)
        _ = try sut.crashed("a", run: 1, problem: "its page ended (crashed)")

        // When
        let stopped = try sut.stopped("b", run: 1)

        // Then
        #expect(describe(stopped) == ["tell didTerminate b 1 notRunning requirement"])
        let relaunches = stopped.contains { effect in
            guard case let .tell(_, run) = effect else { return false }
            return run.relaunches
        }
        #expect(!relaunches)
    }

    @Test("what runs is the catalog as it was last read")
    func lastReadRuns() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        try write("b")

        // When
        let effects = try sut.reconcile()

        // Then
        #expect(describe(effects) == ["open a", "tell willLaunch a 1 launching", "load a"])
    }

    @Test("every mod terminates, and launches again in the load order once none terminates")
    func relaunchAllRelaunchesEveryMod() throws {
        // Given
        try write("a")
        try write("b")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)
        _ = try sut.crashed("b", run: 1, problem: "its page ended (crashed)")

        // When
        _ = catalog.read()
        let effects = try sut.relaunchAll()
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(describe(effects) == ["tell willTerminate a 1 terminating relaunch", "stop a 1"])
        #expect(
            describe(stopped) == [
                "tell didTerminate a 1 notRunning relaunch",
                "tell willLaunch a 2 launching",
                "load a",
                "tell willLaunch b 2 launching",
                "load b"
            ]
        )
    }

    @Test("a mod launched while what it requires is not running fails as it launches, its page not loaded")
    func launchFailsWithoutRequirements() throws {
        // Given
        try write("a")
        try write("b", requires: ["a": "1.0.0"])
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.crashed("a", run: 1, problem: "its page ended (crashed)")
        _ = try sut.stopped("b", run: 1)

        // When
        let effects = try sut.relaunch("b")

        // Then
        #expect(describe(effects) == ["tell willLaunch b 2 launching", "tell didTerminate b 2 notRunning"])
        #expect(sut.run(of: "b")?.problem == "needs a, which is not running")
    }

    @Test("a page that loaded again by itself runs again")
    func loadAgainLaunchesAgain() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)

        // When
        let effects = try sut.loaded("a")

        // Then
        #expect(describe(effects) == ["tell didTerminate a 1 notRunning", "tell willLaunch a 2 launching"])
    }

    @Test("a mod removed goes once its run has ended")
    func removedModCloses() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)
        try FileManager.default.removeItem(at: source.appending(path: "a"))

        // When
        _ = catalog.read()
        let effects = try sut.reconcile()
        let stopped = try sut.stopped("a", run: 1)
        let loaded = Result { try sut.loaded("a") }

        // Then
        #expect(describe(effects) == ["closing a", "tell willTerminate a 1 terminating removed", "stop a 1"])
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning removed", "close a removed"])
        #expect(throws: RunnerError.noSandbox("a")) { try loaded.get() }
    }

    @Test("a mod whose code changed runs again in a new sandbox once its old one has closed")
    func updatedModOpensAgain() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)
        try write("a", version: "1.1.0")

        // When
        _ = catalog.read()
        let effects = try sut.reconcile()
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(describe(effects) == ["closing a", "tell willTerminate a 1 terminating updated", "stop a 1"])
        #expect(
            describe(stopped) == [
                "tell didTerminate a 1 notRunning updated",
                "close a updated",
                "open a",
                "tell willLaunch a 2 launching",
                "load a"
            ]
        )
    }

    @Test("a mod that opens while what it requires is down fails as it launches, and launches as asked once that runs")
    func openedModFailsWithoutItsRequirement() throws {
        // Given
        try write("a")
        try write("b", requires: ["a": "1.0.0"])
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)
        _ = try sut.started("b", run: 1)
        _ = try sut.crashed("a", run: 1, problem: "its page ended (crashed)")
        _ = try sut.stopped("b", run: 1)
        try write("b", version: "1.1.0", requires: ["a": "1.0.0"])

        // When
        _ = catalog.read()
        let effects = try sut.reconcile()
        let relaunched = try sut.relaunch("a")
        let dependents = try sut.launchDependents(of: "a")

        // Then
        #expect(
            describe(effects) == [
                "closing b",
                "close b updated",
                "open b",
                "tell willLaunch b 2 launching",
                "tell didTerminate b 2 notRunning"
            ]
        )
        #expect(describe(relaunched) == ["tell willLaunch a 2 launching", "load a"])
        #expect(describe(dependents) == ["tell willLaunch b 3 launching", "load b"])
    }

    @Test("the app quits once every run has ended, and nothing opens meanwhile")
    func quitWaitsForEveryRun() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.started("a", run: 1)

        // When
        let effects = try sut.quit()
        try write("b")
        _ = catalog.read()
        let reconciled = try sut.reconcile()
        let loaded = Result { try sut.loaded("a") }
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(describe(effects) == ["tell willTerminate a 1 terminating quit", "stop a 1"])
        #expect(reconciled.isEmpty)
        #expect(throws: RunnerError.quitting("a")) { try loaded.get() }
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning quit", "quit"])
    }

    // MARK: - Private
    private func runner() throws -> (Runner, Catalog) {
        let store = Store()
        let reader = try ManifestReader(api: try #require(Version("1.0.0")), permissions: [], fields: [], store: store)
        let modFolder = ModFolder(reader: reader, store: store)
        let folder = home.appending(path: "mods")
        let catalog = Catalog(
            folder: folder,
            sources: [source],
            ship: [],
            modFolder: modFolder,
            dataFolder: DataFolder(folder: home.appending(path: "data"), store: store),
            installer: Installer(home: home, folder: folder, ship: [], modFolder: modFolder, store: store),
            loadOrder: LoadOrder(file: home.appending(path: "deck.json"), store: store),
            store: store
        )

        return (Runner(catalog: catalog), catalog)
    }

    private func write(
        _ id: String,
        version: String = "1.0.0",
        main: String? = "main.js",
        requires: [String: String] = [:]
    ) throws {
        let location = source.appending(path: id)
        try FileManager.default.createDirectory(at: location, withIntermediateDirectories: true)
        let dependencies = requires.isEmpty
            ? ""
            : "\n[requires]\n" + requires.map { other, want in "\(other) = \"\(want)\"" }.joined(separator: "\n")
        let text = """
            id = "\(id)"
            version = "\(version)"
            api = "1.0.0"
            main = "\(main ?? "missing.js")"
            """ + dependencies
        try Data(text.utf8).write(to: location.appending(path: "manifest.toml"))
        if let main {
            try Data().write(to: location.appending(path: main))
        }
    }

    private func describe(_ effects: [Effect]) -> [String] {
        effects.map(\.line)
    }
}
