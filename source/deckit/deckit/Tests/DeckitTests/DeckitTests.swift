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
        #expect(sut.runs.entry(of: ended)?.relaunchLimited == true)
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
        try fixture.write("m", permissions: ["deckit.mods"])
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
        try fixture.write("m", permissions: ["deckit.mods"])
        let again = Permission(id: "deckit.mods", name: "Mods", means: "to test")

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
        _ = try sut.deck.connections.begin(mod: "c", run: 1, lifecycle: 0)

        // When
        let effects = try sut.started("c", run: 1, contributions: Contribution(exportedIn: [:], awaits: ["p/api": 0]))

        // Then
        #expect(effects.contains { effect in
            guard case let .wait(name, _, service) = effect else { return false }
            return name == "p/api" && service == "p"
        })
        #expect(launches(in: effects) == ["p"])
    }

    // MARK: - Private
    // The mods whose runs `effects` tell will launch, in order.
    private func launches(in effects: [Effect]) -> [String] {
        effects.compactMap { effect in
            guard case let .tell(.willLaunch, run) = effect else { return nil }
            return run.modId
        }
    }
}
