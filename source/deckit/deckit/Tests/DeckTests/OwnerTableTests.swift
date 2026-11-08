//
//  OwnerTableTests.swift
//  DeckTests
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("OwnerTable")
struct OwnerTableTests {
    // MARK: - Property
    private let home: URL
    private let sut: OwnerTable

    // MARK: - Initializer
    init() {
        home = FileManager.default.temporaryDirectory.appending(path: "owner-table-tests-\(UUID().uuidString)")
        let settings = DeckSettings(file: home.appending(path: "deck.json"), store: Store())
        sut = OwnerTable(store: OwnershipStore(settings: settings))
    }

    // MARK: - Test
    @Test("the jobs that provide join each queue in the order given, the first owning it, kept in deck.json")
    func provideQueuesInOrder() throws {
        // Given
        let jobs = [Job.fixture("b", provides: ["x/api": [1]]), .fixture("a", provides: ["x/api": [1], "a/api": [1]])]

        // When
        let ownership = sut.provide(jobs, keeping: [])
        let read = OwnershipStore(settings: settings()).read()

        // Then
        #expect(ownership.queues == ["x/api": ["b", "a"], "a/api": ["a"]])
        #expect(ownership.owner(of: "x/api") == "b")
        #expect(read == ownership)
        #expect(sut.ownership == ownership)
    }

    @Test("a principal that no longer provides leaves its queues and pins, and one kept holds its place")
    func providerLeavesUnlessKept() throws {
        // Given
        let b = Job.fixture("b", provides: ["x/api": [1]])
        let c = Job.fixture("c", provides: ["x/api": [1]])
        let d = Job.fixture("d", provides: ["x/api": [1]])
        sut.provide([b, c, d], keeping: [])
        try sut.pin("x/api", to: "c")

        // When
        let kept = sut.provide([d], keeping: ["b"])

        // Then
        #expect(kept.queues == ["x/api": ["b", "d"]])
        #expect(kept.pins.isEmpty)
        #expect(kept.owner(of: "x/api") == "b")
    }

    @Test("a pin owns the interface whatever its queue says, is kept in deck.json, and clears for nil")
    func pinOwnsTheInterface() throws {
        // Given
        sut.provide([.fixture("b", provides: ["x/api": [1]]), .fixture("c", provides: ["x/api": [1]])], keeping: [])

        // When
        try sut.pin("x/api", to: "c")
        let pinned = sut.ownership.owner(of: "x/api")
        let read = OwnershipStore(settings: settings()).read()
        try sut.pin("x/api", to: nil)

        // Then
        #expect(pinned == "c")
        #expect(read.pins == ["x/api": "c"])
        #expect(sut.ownership.owner(of: "x/api") == "b")
    }

    @Test("a pin is refused for a principal that did not provide the interface as the jobs were last provided")
    func pinOfANonProviderIsRefused() throws {
        // Given
        sut.provide([.fixture("b", provides: ["x/api": [1]]), .fixture("c")], keeping: [])

        // When
        let pinned = Result { try sut.pin("x/api", to: "c") }

        // Then
        #expect(throws: PinError.notProvider(interface: "x/api", principal: "c")) { try pinned.get() }
        #expect(sut.ownership.pins.isEmpty)
    }

    // MARK: - Private
    private func settings() -> DeckSettings {
        DeckSettings(file: home.appending(path: "deck.json"), store: Store())
    }
}
