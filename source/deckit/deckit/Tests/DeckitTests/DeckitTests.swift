//
//  DeckitTests.swift
//  DeckitTests
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("Deckit")
struct DeckitTests {
    // MARK: - Property
    private let fixture = DeckitFixture("deckit-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("at start the background mods launch, and no other")
    func startLaunchesBackgroundMods() throws {
        // Given
        try fixture.write("a")
        try fixture.write("b", background: "to sync")
        let sut = try fixture.deckit()

        // When
        let effects = try sut.start()

        // Then
        #expect(launches(in: effects) == ["b"])
    }

    @Test("a background mod's failed run launches again until its mod reaches the relaunch limit")
    func failedBackgroundModLaunchesUntilLimit() throws {
        // Given
        try fixture.write("b", background: "to sync")
        let sut = try fixture.deckit(
            limit: RelaunchLimit(burst: 2, interval: 10),
            now: { Date(timeIntervalSince1970: 0) }
        )
        _ = try sut.start()

        // When
        let first = try sut.crashed("b", run: 1, problem: "its page ended")
        let second = try sut.crashed("b", run: 2, problem: "its page ended")

        // Then
        #expect(launches(in: first) == ["b"])
        #expect(launches(in: second) == [])
        let ended = try #require(sut.deck.run(of: "b"))
        #expect(ended.number == 2)
        #expect(ended.state == .notRunning)
        #expect(sut.refusal(of: ended) == .relaunchLimit("b"))
    }

    @Test("a background mod whose launch fails launches again at once, and its run is refused as it did not launch")
    func failedLaunchLaunchesAgain() throws {
        // Given
        try fixture.write("b", background: "to sync")
        let sut = try fixture.deckit()
        _ = try sut.start()

        // When
        let effects = try sut.notStarted("b", run: 1, problem: "threw")

        // Then
        #expect(launches(in: effects) == ["b"])
        let failed = try #require(effects.compactMap { effect -> Run? in
            guard case let .tell(.didFailToLaunch, run) = effect else { return nil }
            return run
        }.first)
        #expect(failed.state == .notRunning)
        #expect(sut.refusal(of: failed) == .notLaunched(mod: "b", problem: "threw"))
        #expect(try sut.refusal(of: #require(sut.deck.run(of: "b"))) == nil)
    }

    @Test("a run whose code does not start in time fails to launch, timed out, and one that launched is not timed out")
    func launchTimesOut() throws {
        // Given
        try fixture.write("a")
        try fixture.write("b")
        let sut = try fixture.deckit()
        _ = try sut.load(["a", "b"])
        _ = try sut.started("b", run: 1, contributions: Contribution(exportedIn: [:], awaits: [:]))

        // When
        _ = try sut.timedOut("a", run: 1)
        let late = try sut.timedOut("b", run: 1)

        // Then
        let run = try #require(sut.deck.run(of: "a"))
        #expect(run.state == .notRunning)
        #expect(sut.refusal(of: run) == .timedOut(mod: "a", problem: "its code did not start in time"))
        #expect(late.isEmpty)
        #expect(try #require(sut.deck.run(of: "b")).state == .running)
    }

    @Test("a launch or a quit of an id no mod is listed under is refused, and a launch of a mod that does not load")
    func launchOfUnknownIdIsRefused() throws {
        // Given
        try fixture.write("bad", api: "9.0.0")
        let sut = try fixture.deckit()

        // When
        let unknown = #expect(throws: LaunchError.self) { try sut.launch("x", by: nil) }
        let quit = #expect(throws: LaunchError.self) { try sut.quit("x", by: nil) }
        let refused = #expect(throws: ModFolderError.self) { try sut.launch("bad", by: nil) }

        // Then
        #expect(unknown == .notInstalled("x"))
        #expect(quit == .notInstalled("x"))
        #expect(refused != nil)
    }

    @Test("a failed run of a mod that does not run in the background does not launch again")
    func failedModLaunchesNoMore() throws {
        // Given
        try fixture.write("a")
        let sut = try fixture.deckit()
        _ = try sut.load(["a"])

        // When
        let effects = try sut.crashed("a", run: 1, problem: "its page ended")

        // Then
        #expect(launches(in: effects) == [])
    }

    @Test("a mod at the relaunch limit launches again as a mod granted deckit.mods asks for it")
    func askedLaunchResetsLimit() throws {
        // Given
        try fixture.write("a")
        try fixture.write("m", system: true, permissions: ["deckit.mods"])
        let sut = try fixture.deckit(limit: RelaunchLimit(burst: 1, interval: 10))
        _ = try sut.load(["a", "m"])
        _ = try sut.crashed("a", run: 1, problem: "its page ended")

        // When
        let held = try sut.load(["a"])
        let refused = #expect(throws: LaunchError.self) { try sut.launch("a", by: "a") }
        let launched = try sut.launch("a", by: "m")

        // Then
        #expect(launches(in: held) == [])
        #expect(refused == .notPermitted(mod: "a", permission: "deckit.mods"))
        #expect(launches(in: launched) == ["a"])
    }

    @Test("a launch asked with no mod asking is not checked, and takes the mod off the relaunch limit")
    func launchWithNoAskerResetsLimit() throws {
        // Given
        try fixture.write("a")
        let sut = try fixture.deckit(limit: RelaunchLimit(burst: 1, interval: 10))
        _ = try sut.load(["a"])
        _ = try sut.crashed("a", run: 1, problem: "its page ended")

        // When
        let launched = try sut.launch("a", by: nil)

        // Then
        #expect(launches(in: launched) == ["a"])
    }

    @Test("deckit defines deckit.mods itself, and refuses it defined again")
    func deckitDefinesModsPermission() throws {
        // Given
        try fixture.write("m", system: true, permissions: ["deckit.mods"])
        let again = Permission(id: "deckit.mods", name: "Mods", description: "to test")

        // When
        let sut = try fixture.deckit()
        let refused = #expect(throws: ManifestError.self) { try fixture.deckit(permissions: [again]) }

        // Then
        let mod = try #require(sut.catalog.loading.first { mod in mod.manifest.id == "m" })
        #expect(Job(mod)?.permissions == ["deckit.mods"])
        #expect(refused == .permissionDefined("deckit.mods"))
    }

    @Test("the sandbox of a mod removed from the registry closes once its run has ended")
    func removedModSandboxCloses() throws {
        // Given
        try fixture.write("a", spare: true)
        let sut = try fixture.deckit()
        _ = try sut.catalog.install(from: fixture.folder(of: "a"))
        _ = sut.readCatalog()
        _ = try sut.load(["a"])
        _ = try sut.catalog.remove("a")
        _ = sut.readCatalog()
        _ = try sut.unload(["a"])

        // When
        let effects = try sut.stopped("a", run: 1)

        // Then
        #expect(effects.contains { effect in
            guard case let .close(id) = effect else { return false }
            return id == "a"
        })
        #expect(sut.deck.job(of: "a") == nil)
    }

    @Test("a mod a lifecycle waits for launches")
    func waitLaunchesTheMod() throws {
        // Given
        try fixture.write("p", provides: ["p/api"])
        try fixture.write("c", uses: ["p/api"])
        let sut = try fixture.deckit()
        _ = try sut.load(["c"])
        _ = try sut.deck.connections.begin(principal: "c", run: 1, lifecycle: 0)

        // When
        let effects = try sut.started("c", run: 1, contributions: Contribution(exportedIn: [:], awaits: ["p/api": 0]))

        // Then
        #expect(effects.contains { effect in
            guard case let .wait(name, _, service) = effect else { return false }
            return name == "p/api" && service == "p"
        })
        #expect(launches(in: effects) == ["p"])
    }

    @Test("a mod granted deckit.reach-mods reaches any mod by id, which launches as it waits for it, and others none")
    func reachModsReachesEveryMod() throws {
        // Given
        try fixture.write("t")
        try fixture.write("n")
        try fixture.write("r", system: true, permissions: ["deckit.reach-mods"])
        let sut = try fixture.deckit()
        _ = try sut.load(["r", "n"])
        _ = try sut.deck.connections.begin(principal: "r", run: 1, lifecycle: 0)
        _ = try sut.deck.connections.begin(principal: "n", run: 1, lifecycle: 0)

        // When
        let reached = try sut.reach("t", from: "r", run: 1, lifecycle: 0)
        let refused = #expect(throws: ConnectionError.self) { try sut.reach("t", from: "n", run: 1, lifecycle: 0) }

        // Then
        #expect(sut.deck.job(of: "r")?.reaches == .every)
        #expect(sut.deck.job(of: "n")?.reaches == .only([]))
        #expect(reached.contains { effect in
            guard case let .wait(name, client, service) = effect else { return false }
            return name == "t" && client.principal == "r" && service == "t"
        })
        #expect(launches(in: reached) == ["t"])
        #expect(refused == .outOfReach(principal: "t", client: "n"))
    }

    @Test("a mod reached by id connects once it opens its exports for its id, and a release ends the connection")
    func reachConnectsAndReleaseEnds() throws {
        // Given
        try fixture.write("t")
        try fixture.write("r", system: true, permissions: ["deckit.reach-mods"])
        let sut = try fixture.deckit()
        _ = try sut.load(["r"])
        _ = try sut.deck.connections.begin(principal: "r", run: 1, lifecycle: 0)
        _ = try sut.reach("t", from: "r", run: 1, lifecycle: 0)
        _ = try sut.deck.connections.begin(principal: "t", run: 1, lifecycle: 0)

        // When
        let started = try sut.started("t", run: 1, contributions: Contribution(exportedIn: ["t": 0], awaits: [:]))
        let released = try sut.release("t", from: "r", run: 1, lifecycle: 0)

        // Then
        let connected = started.compactMap { effect -> Connection? in
            guard case let .connect(connection) = effect else { return nil }
            return connection
        }
        #expect(connected.map(\.name) == ["t"])
        #expect(connected.map(\.credential) == [Credential(principal: "r", permissions: ["deckit.reach-mods"])])
        #expect(released.contains { effect in
            guard case let .disconnect(connection) = effect else { return false }
            return connection.name == "t" && connection.client.principal == "r"
        })
    }

    // MARK: - Private
    // The mods whose runs `effects` tell will launch, in order.
    private func launches(in effects: [Effect]) -> [String] {
        effects.compactMap { effect in
            guard case let .tell(.willLaunch, run) = effect else { return nil }
            return run.principal
        }
    }
}
