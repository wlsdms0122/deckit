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
    // MARK: - Initializer
    // MARK: - Test
    @Test("each job opens a sandbox, launches and loads its page, in the order given")
    func loadOpensEachJob() throws {
        // Given
        let sut = Runner()

        // When
        let effects = try sut.load([.fixture("b"), .fixture("a")])

        // Then
        #expect(
            describe(effects) == [
                "open b",
                "tell willLaunch b 1 launching",
                "loadPage b",
                "open a",
                "tell willLaunch a 1 launching",
                "loadPage a"
            ]
        )
        #expect(sut.jobs().map(\.principal) == ["b", "a"])
    }

    @Test("a run launches once its page says it started, and what an older run says is not the newer one's")
    func startedLaunchesTheLatestRun() throws {
        // Given
        let sut = Runner()
        _ = try sut.load([.fixture("a")])

        // When
        let stale = try sut.started("a", run: 2)
        let effects = try sut.started("a", run: 1)

        // Then
        #expect(stale.isEmpty)
        #expect(describe(effects) == ["tell didLaunch a 1 running"])
    }

    @Test("a run asked to unload terminates, its stop() asked once, and ends once that answered, its sandbox killed")
    func unloadAsksTheStop() throws {
        // Given
        let sut = Runner()
        try launch(["a"], with: sut)

        // When
        let unloaded = try sut.unload(["a"])
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(describe(unloaded) == ["tell willTerminate a 1 terminating", "stop a 1"])
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning", "kill a"])
        #expect(sut.run(of: "a")?.failed == false)
    }

    @Test("the first problem recorded against a run is kept, and told with no step, once")
    func problemIsKept() throws {
        // Given
        let sut = Runner()
        _ = try sut.load([.fixture("a")])

        // When
        let first = try sut.report("a", run: 1, problem: "a listener threw")
        let second = try sut.report("a", run: 1, problem: "another threw")

        // Then
        #expect(describe(first) == ["keep a 1 a listener threw"])
        #expect(describe(second).isEmpty)
    }

    @Test("a run that did not start ends failing at once, its sandbox killed")
    func failedLaunchEnds() throws {
        // Given
        let sut = Runner()
        _ = try sut.load([.fixture("a")])

        // When
        let failed = try sut.notStarted("a", run: 1, problem: "start threw")
        let stopped = try sut.stopped("a", run: 1)

        // Then
        let run = try #require(sut.run(of: "a"))
        #expect(describe(failed) == ["tell didFailToLaunch a 1 notRunning", "kill a"])
        #expect(describe(stopped).isEmpty)
        #expect(run.failed)
        #expect(run.problem == "start threw")
    }

    @Test("a run that crashed before its end was asked ended failing, and one that crashed as it terminated did not")
    func crashFailsUnlessAsked() throws {
        // Given
        let sut = Runner()
        try launch(["a", "b"], with: sut)
        _ = try sut.unload(["b"])

        // When
        let crashed = try sut.crashed("a", run: 1, problem: "gone")
        _ = try sut.crashed("b", run: 1, problem: "gone as asked")

        // Then
        #expect(describe(crashed) == ["tell didTerminate a 1 notRunning"])
        #expect(sut.run(of: "a")?.failed == true)
        #expect(sut.run(of: "b")?.failed == false)
    }

    @Test("a run asked to unload again as it terminates tells nothing more")
    func terminatingRunUnloadsOnce() throws {
        // Given
        let sut = Runner()
        try launch(["a"], with: sut)
        _ = try sut.unload(["a"])

        // When
        let again = try sut.unload(["a"])
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(again.isEmpty)
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning", "kill a"])
    }

    @Test("a principal whose run launches or runs is left as it is, and one that ended launches again in its sandbox")
    func loadLaunchesOnlyWhatEnded() throws {
        // Given
        let sut = Runner()
        try launch(["a"], with: sut)

        // When
        let running = try sut.load([.fixture("a")])
        _ = try sut.unload(["a"])
        _ = try sut.stopped("a", run: 1)
        let ended = try sut.load([.fixture("a")])
        let launching = try sut.load([.fixture("a")])

        // Then
        #expect(running.isEmpty)
        #expect(describe(ended) == ["tell willLaunch a 2 launching", "loadPage a"])
        #expect(launching.isEmpty)
    }

    @Test("a job loaded as its run terminates launches once that run has ended, in a new sandbox for a new revision")
    func loadAsARunTerminatesLaunchesOnceItEnded() throws {
        // Given
        let sut = Runner()
        try launch(["a", "b"], with: sut)
        _ = try sut.unload(["a", "b"])

        // When
        let terminating = try sut.load([.fixture("a"), .fixture("b", revision: "2")])
        let a = try sut.stopped("a", run: 1)
        let b = try sut.stopped("b", run: 1)

        // Then
        #expect(terminating.isEmpty)
        #expect(
            describe(a) == ["tell didTerminate a 1 notRunning", "kill a", "tell willLaunch a 2 launching", "loadPage a"]
        )
        #expect(
            describe(b) == [
                "tell didTerminate b 1 notRunning",
                "kill b",
                "close b",
                "open b",
                "tell willLaunch b 2 launching",
                "loadPage b"
            ]
        )
        #expect(sut.job(of: "b")?.revision == "2")
    }

    @Test("a job loaded as its principal's run terminates is dropped as the principal unloads before that run ends")
    func unloadDropsTheLoadKept() throws {
        // Given
        let sut = Runner()
        try launch(["a"], with: sut)
        _ = try sut.unload(["a"])
        _ = try sut.load([.fixture("a")])

        // When
        let unloaded = try sut.unload(["a"])
        let stopped = try sut.stopped("a", run: 1)

        // Then
        #expect(unloaded.isEmpty)
        #expect(describe(stopped) == ["tell didTerminate a 1 notRunning", "kill a"])
    }

    @Test("a sandbox stays once its run has ended, and closes as it is unloaded")
    func unloadOfAnEndedRunCloses() throws {
        // Given
        let sut = Runner()
        try launch(["a"], with: sut)
        _ = try sut.unload(["a"])
        _ = try sut.stopped("a", run: 1)
        let kept = sut.jobs().map(\.principal)

        // When
        let closed = try sut.unload(["a"])

        // Then
        #expect(kept == ["a"])
        #expect(describe(closed) == ["close a"])
        #expect(sut.jobs().isEmpty)
        #expect(sut.run(of: "a") == nil)
    }

    @Test("a job of another revision than its principal's ended sandbox launches in a new one, its run counted on")
    func newRevisionOpensANewSandbox() throws {
        // Given
        let sut = Runner()
        try launch(["a"], with: sut)
        _ = try sut.unload(["a"])
        _ = try sut.stopped("a", run: 1)

        // When
        let effects = try sut.load([.fixture("a", revision: "2")])

        // Then
        #expect(describe(effects) == ["close a", "open a", "tell willLaunch a 2 launching", "loadPage a"])
        #expect(sut.job(of: "a")?.revision == "2")
    }

    // MARK: - Private
    // Each principal loads and starts in turn.
    private func launch(_ ids: [String], with sut: Runner) throws {
        for id in ids {
            _ = try sut.load([.fixture(id)])
            _ = try sut.started(id, run: try #require(sut.run(of: id)).number)
        }
    }

    private func describe(_ effects: [Effect]) -> [String] {
        effects.map(\.line)
    }
}
