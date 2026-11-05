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
    @Test("each mod named that loads opens, launches and loads its page, in the mods' order")
    func loadOpensEachMod() throws {
        // Given
        try write("a")
        try write("b", main: nil)
        let (sut, catalog) = try runner()

        // When
        _ = catalog.read()
        let effects = try sut.load(["b", "a"])

        // Then
        #expect(describe(effects) == ["open a", "tell willLaunch a 1 launching", "loadPage a"])
    }

    @Test("a run launches once its page says it started, and what an older run says is not the newer one's")
    func startedLaunchesTheLatestRun() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.load(["a"])

        // When
        let stale = try sut.started("a", run: 2)
        let effects = try sut.started("a", run: 1)

        // Then
        #expect(stale.isEmpty)
        #expect(describe(effects) == ["tell didLaunch a 1 running"])
    }

    @Test("a mod loaded while what it requires launches fails as it launches, and launches once that runs")
    func dependentLoadsOnceItsRequirementRuns() throws {
        // Given
        try write("a")
        try write("b", requires: ["a": "1.0.0"])
        let (sut, catalog) = try runner()
        _ = catalog.read()

        // When
        let together = try sut.load(["a", "b"])
        _ = try sut.started("a", run: 1)
        let after = try sut.load(["b"])

        // Then
        #expect(
            describe(together) == [
                "open a",
                "tell willLaunch a 1 launching",
                "loadPage a",
                "open b",
                "tell willLaunch b 1 launching",
                "tell didTerminate b 1 notRunning"
            ]
        )
        #expect(describe(after) == ["tell willLaunch b 2 launching", "loadPage b"])
    }

    @Test("a mod terminates before what it requires, whose stop() is asked once it has ended")
    func dependentsEndFirst() throws {
        // Given
        try write("a")
        try write("b", requires: ["a": "1.0.0"])
        let (sut, catalog) = try runner()
        _ = catalog.read()
        try launch(["a", "b"], with: sut)

        // When
        let unloaded = try sut.unload(["a"])
        let dependentStopped = try sut.stopped("b", run: 1)
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(
            describe(unloaded) == [
                "tell willTerminate a 1 terminating",
                "tell willTerminate b 1 terminating",
                "stop b 1"
            ]
        )
        #expect(describe(dependentStopped) == ["tell didTerminate b 1 notRunning", "stop a 1"])
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning"])
    }

    @Test("a mod whose requirement crashed terminates, and stays down once that runs again")
    func dependentStaysDownAfterItsRequirement() throws {
        // Given
        try write("a")
        try write("b", requires: ["a": "1.0.0"])
        let (sut, catalog) = try runner()
        _ = catalog.read()
        try launch(["a", "b"], with: sut)

        // When
        let crashed = try sut.crashed("a", run: 1, problem: "its page ended (crashed)")
        let stopped = try sut.stopped("b", run: 1)
        let loaded = try sut.load(["a"])

        // Then
        #expect(
            describe(crashed) == [
                "tell didTerminate a 1 notRunning",
                "tell willTerminate b 1 terminating",
                "stop b 1"
            ]
        )
        #expect(describe(stopped) == ["tell didTerminate b 1 notRunning"])
        #expect(describe(loaded) == ["tell willLaunch a 2 launching", "loadPage a"])
    }

    @Test("the first problem recorded against a run is kept, and told with no step, once")
    func problemIsKept() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.load(["a"])

        // When
        let first = try sut.report("a", run: 1, problem: "a listener threw")
        let second = try sut.report("a", run: 1, problem: "another threw")

        // Then
        #expect(describe(first) == ["keep a 1 a listener threw"])
        #expect(describe(second).isEmpty)
    }

    @Test("a run that did not start terminates, its stop() asked, and ends once that answered")
    func failedLaunchEnds() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.load(["a"])

        // When
        let failed = try sut.notStarted("a", run: 1, problem: "start threw")
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(describe(failed) == ["tell didFailToLaunch a 1 terminating", "stop a 1"])
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning"])
    }

    @Test("a run keeps the origin of the request that launched it, and whether it ended failing")
    func runKeepsOriginAndFailure() throws {
        // Given
        try write("a")
        try write("b")
        try write("c")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        let work = LaunchOrigin.work(.object(["command": .string("x")]), mod: "c")

        // When
        _ = try sut.load([
            LaunchRequest(modId: "a", origin: .startup),
            LaunchRequest(modId: "b", origin: work),
            LaunchRequest(modId: "c", origin: .required(by: "b"))
        ])
        _ = try sut.started("a", run: 1)
        _ = try sut.started("b", run: 1)
        _ = try sut.crashed("a", run: 1, problem: "its page ended (crashed)")
        _ = try sut.unload(["b"])
        _ = try sut.stopped("b", run: 1)
        _ = try sut.notStarted("c", run: 1, problem: "start threw")
        _ = try sut.stopped("c", run: 1)

        // Then
        let runs = try ["a", "b", "c"].map { id in try #require(sut.run(of: id)) }
        #expect(runs.map(\.origin) == [.startup, work, .required(by: "b")])
        #expect(runs.map(\.failed) == [true, false, true])
        #expect(runs.allSatisfy { run in run.state == .notRunning && !run.relaunchLimited })
    }

    @Test("a mod whose runs failed five times within ten seconds launches again only as the person opens it")
    func relaunchLimitHolds() throws {
        // Given
        try write("a")
        var now = Date(timeIntervalSince1970: 0)
        let (sut, catalog) = try runner { now }
        _ = catalog.read()
        let startup = [LaunchRequest(modId: "a", origin: .startup)]

        // When
        var limited: [Bool] = []
        for number in 1...5 {
            _ = try sut.load(startup)
            _ = try sut.crashed("a", run: number, problem: "its page ended (crashed)")
            limited.append(try #require(sut.run(of: "a")).relaunchLimited)
            now += 2
        }
        let held = try sut.load(startup)
        let opened = try sut.load([LaunchRequest(modId: "a", origin: .person)])
        _ = try sut.crashed("a", run: 6, problem: "its page ended (crashed)")
        let again = try sut.load(startup)

        // Then
        #expect(limited == [false, false, false, false, true])
        #expect(describe(held).isEmpty)
        #expect(describe(opened) == ["tell willLaunch a 6 launching", "loadPage a"])
        #expect(describe(again) == ["tell willLaunch a 7 launching", "loadPage a"])
    }

    @Test("failures further apart than the limit's interval, or a run that ended itself, do not reach the limit")
    func spreadFailuresDoNotReachTheLimit() throws {
        // Given
        try write("a")
        try write("b")
        var now = Date(timeIntervalSince1970: 0)
        let (sut, catalog) = try runner { now }
        _ = catalog.read()

        // When
        for number in 1...6 {
            _ = try sut.load([LaunchRequest(modId: "a", origin: .startup)])
            _ = try sut.crashed("a", run: number, problem: "its page ended (crashed)")
            _ = try sut.load([LaunchRequest(modId: "b", origin: .startup)])
            _ = try sut.unload(["b"])
            _ = try sut.stopped("b", run: number)
            now += 3
        }
        let a = try sut.load([LaunchRequest(modId: "a", origin: .startup)])
        let b = try sut.load([LaunchRequest(modId: "b", origin: .startup)])

        // Then
        #expect(describe(a) == ["tell willLaunch a 7 launching", "loadPage a"])
        #expect(describe(b) == ["tell willLaunch b 7 launching", "loadPage b"])
    }

    @Test("a run asked to unload again as it terminates tells nothing more")
    func terminatingRunUnloadsOnce() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        try launch(["a"], with: sut)
        _ = try sut.unload(["a"])

        // When
        let again = try sut.unload(["a"])
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(again.isEmpty)
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning"])
    }

    @Test("a mod whose run has not ended is left as it is, and one that ended launches again in its sandbox")
    func loadLaunchesOnlyWhatEnded() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        try launch(["a"], with: sut)

        // When
        let running = try sut.load(["a"])
        _ = try sut.unload(["a"])
        let terminating = try sut.load(["a"])
        _ = try sut.stopped("a", run: 1)
        let ended = try sut.load(["a"])

        // Then
        #expect(running.isEmpty)
        #expect(terminating.isEmpty)
        #expect(describe(ended) == ["tell willLaunch a 2 launching", "loadPage a"])
    }

    @Test("what loads is the catalog as it was last read")
    func lastReadLoads() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        try write("b")

        // When
        let effects = try sut.load(["a", "b"])

        // Then
        #expect(describe(effects) == ["open a", "tell willLaunch a 1 launching", "loadPage a"])
    }

    @Test("a mod removed closes once its run has ended, and loads no more")
    func removedModCloses() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        try launch(["a"], with: sut)
        try FileManager.default.removeItem(at: source.appending(path: "a"))

        // When
        _ = catalog.read()
        let unloaded = try sut.unload(["a"])
        let stopped = try sut.stopped("a", run: 1)
        let loaded = try sut.load(["a"])

        // Then
        #expect(describe(unloaded) == ["tell willTerminate a 1 terminating", "stop a 1"])
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning", "close a"])
        #expect(loaded.isEmpty)
    }

    @Test("a mod whose code changed loads in a new sandbox once its old one has closed")
    func updatedModOpensAgain() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        try launch(["a"], with: sut)
        try write("a", version: "1.1.0")

        // When
        _ = catalog.read()
        _ = try sut.unload(["a"])
        let stopped = try sut.stopped("a", run: 1)
        let loaded = try sut.load(["a"])

        // Then
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning", "close a"])
        #expect(describe(loaded) == ["open a", "tell willLaunch a 2 launching", "loadPage a"])
    }

    @Test("a sandbox whose run ended before its mod changed closes as the mod loads, or unloads")
    func endedSandboxOfAChangedModCloses() throws {
        // Given
        try write("a")
        try write("b")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.load(["a", "b"])
        _ = try sut.crashed("a", run: 1, problem: "its page ended (crashed)")
        _ = try sut.crashed("b", run: 1, problem: "its page ended (crashed)")
        try write("a", version: "1.1.0")
        try FileManager.default.removeItem(at: source.appending(path: "b"))

        // When
        _ = catalog.read()
        let loaded = try sut.load(["a"])
        let unloaded = try sut.unload(["b"])

        // Then
        #expect(describe(loaded) == ["close a", "open a", "tell willLaunch a 2 launching", "loadPage a"])
        #expect(describe(unloaded) == ["close b"])
    }

    @Test("what a launching run's page read of its entry is kept, and a run past launching keeps what it has")
    func launchingRunIsDescribed() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.load(["a"])

        // When
        let described = try sut.described("a", run: 1, summary: .object(["x": .string("1")]))
        _ = try sut.started("a", run: 1)
        let late = try sut.described("a", run: 1, summary: .object(["x": .string("")]))

        // Then
        #expect(describe(described) == ["keep a 1 "])
        #expect(late.isEmpty)
        #expect(try #require(sut.run(of: "a")).summary == .object([:]))
    }

    @Test("a running run contributes anew, what it contributes now in place of what it did; one not running does not")
    func runningRunJoins() throws {
        // Given
        try write("a")
        let (sut, catalog) = try runner()
        _ = catalog.read()
        _ = try sut.load(["a"])
        let joining = Contribution(exportedIn: ["a": 1], awaits: ["b": 1], layers: ["layer": .array([])])
        let early = try sut.joined("a", run: 1, summary: .object([:]), contributions: joining)
        _ = try sut.started("a", run: 1, exportedIn: ["a": 0])

        // When
        let joined = try sut.joined("a", run: 1, summary: .object(["x": .bool(true)]), contributions: joining)

        // Then
        let run = try #require(sut.run(of: "a"))
        #expect(early.isEmpty)
        #expect(describe(joined) == ["keep a 1 "])
        #expect(run.summary == .object(["x": .bool(true)]))
        #expect(run.contributions?.exportedIn == ["a": 1])
        #expect(run.contributions?.awaits == ["b": 1])
        #expect(run.contributions?.layers == ["layer": .array([])])
    }

    // MARK: - Private
    // `now` is the time a run fails at.
    private func runner(now: @escaping () -> Date = Date.init) throws -> (Runner, Catalog) {
        let store = Store()
        let reader = try ManifestReader(
            api: try #require(Version("1.0.0")),
            permissions: [],
            fields: [],
            store: store
        )
        let modFolder = ModFolder(reader: reader, store: store)
        let folder = home.appending(path: "mods")
        let catalog = Catalog(
            folder: folder,
            sources: [source],
            ship: [],
            modFolder: modFolder,
            dataFolder: DataFolder(folder: home.appending(path: "data"), store: store),
            installer: Installer(home: home, folder: folder, ship: [], modFolder: modFolder, store: store),
            order: Order(file: home.appending(path: "deck.json"), store: store),
            ownershipStore: OwnershipStore(file: home.appending(path: "deck.json"), store: store),
            startupList: StartupList(file: home.appending(path: "deck.json"), store: store),
            store: store
        )

        return (Runner(catalog: catalog, now: now), catalog)
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
            : "\n[dependencies]\n" + requires.map { other, want in "\(other) = \"\(want)\"" }.joined(separator: "\n")
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

    // Each mod launches and starts in turn, so it loads while what it requires runs.
    private func launch(_ ids: [String], with sut: Runner) throws {
        for id in ids {
            _ = try sut.load([id])
            _ = try sut.started(id, run: try #require(sut.run(of: id)).number)
        }
    }

    private func describe(_ effects: [Effect]) -> [String] {
        effects.map(\.line)
    }
}
