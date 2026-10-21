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
    @Test("each mod that loads opens, launches and loads its page, in the person's order")
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

    @Test("a mod terminates before what it requires, whose stop() is asked once it has ended, and both launch again")
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
                "tell willLaunch b 2 launching",
                "load b",
                "load a"
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

    @Test("a mod whose requirement ran again while it terminated launches again as it ends")
    func dependentLaunchesAfterItsRequirement() throws {
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
        #expect(
            describe(stopped) == [
                "tell didTerminate b 1 notRunning requirement",
                "tell willLaunch b 2 launching",
                "load b"
            ]
        )
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

    @Test("every mod terminates and launches again, and one not running launches now")
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

        // Then
        #expect(
            describe(effects) == [
                "tell willTerminate a 1 terminating relaunch",
                "tell willLaunch b 2 launching",
                "load b",
                "stop a 1"
            ]
        )
    }

    @Test("a mod does not launch again while what it requires is not running")
    func relaunchNeedsRequirements() throws {
        // Given
        try write("a")
        try write("b", requires: ["a": "1.0.0"])
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.reconcile()
        _ = try sut.crashed("a", run: 1, problem: "its page ended (crashed)")

        // When
        // Then
        #expect(throws: RunnerError.needs(mod: "b", requirement: "a")) {
            try sut.relaunch("b")
        }
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

        // Then
        #expect(describe(effects) == ["closing a", "tell willTerminate a 1 terminating removed", "stop a 1"])
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning removed", "close a removed"])
        #expect(throws: RunnerError.noSandbox("a")) {
            try sut.loaded("a")
        }
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
        #expect(throws: RunnerError.quitting("a")) {
            try loaded.get()
        }
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
            installer: Installer(home: home, folder: folder, ship: [], modFolder: modFolder, store: store),
            state: State(root: home.appending(path: "state"), store: store),
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
