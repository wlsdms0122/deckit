//
//  EventBusTests.swift
//  DeckTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("EventBus")
struct EventBusTests {
    // MARK: - Property
    private let fixture = RunnerFixture("event-bus-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("an event goes, named after its mod, to the runs that listen to it, and only from a run that is running")
    func testThatAnEventGoesToItsListeners() throws {
        // Given
        try fixture.write("a")
        try fixture.write("b")
        try fixture.write("c")
        let runner = try fixture.runner()
        let sut = EventBus(runner: runner)
        sut.listen(mod: "b", run: 1, names: ["a:status"])
        sut.listen(mod: "c", run: 1, names: ["a:other"])

        // When
        let launching = sut.emit(mod: "a", run: 1, name: "status")
        _ = try runner.started("a", run: 1)
        let running = sut.emit(mod: "a", run: 1, name: "status")
        let older = sut.emit(mod: "a", run: 0, name: "status")

        // Then
        #expect(launching == EventDelivery(name: "a:status", listeners: []))
        #expect(running == EventDelivery(name: "a:status", listeners: ["b"]))
        #expect(older.listeners.isEmpty)
    }

    @Test("a run that has ended hears nothing, and what an older run listens to is not taken")
    func testThatAnEndedRunHearsNothing() throws {
        // Given
        try fixture.write("a")
        try fixture.write("b")
        let runner = try fixture.runner()
        let sut = EventBus(runner: runner)
        _ = try runner.started("a", run: 1)
        _ = try runner.started("b", run: 1)
        sut.listen(mod: "b", run: 1, names: ["a:status"])

        // When
        _ = try runner.relaunch("b")
        _ = try runner.stopped("b", run: 1)
        let relaunched = sut.emit(mod: "a", run: 1, name: "status")
        sut.listen(mod: "b", run: 1, names: ["a:status"])
        let older = sut.emit(mod: "a", run: 1, name: "status")
        sut.listen(mod: "b", run: 2, names: ["a:status"])
        let listening = sut.emit(mod: "a", run: 1, name: "status")

        // Then
        #expect(relaunched.listeners.isEmpty)
        #expect(older.listeners.isEmpty)
        #expect(listening.listeners == ["b"])
    }

    // MARK: - Private
}
