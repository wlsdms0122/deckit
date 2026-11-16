//
//  SeatTests.swift
//  DeckitTests
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("Seat")
struct SeatTests {
    // MARK: - Property
    private let fixture = SeatFixture("seat-tests")
    private let user = User(id: "fable", name: "Fable")
    private let nothing = Contribution(exportedIn: [:], awaits: [:])

    // MARK: - Initializer
    // MARK: - Test
    @Test("a seat closes as its user's run stops, and the next seat takes a number no seat had")
    func seatClosesAsItsRunStops() throws {
        // Given
        let sut = try fixture.deckit()
        _ = try fixture.admit(sut, transport: "t1")
        let run = try #require(sut.deck.run(of: "fable"))
        _ = try sut.started("fable", run: run.number, contributions: nothing)
        let open = sut.seats.all

        // When
        _ = try sut.unload(["fable"])
        let stopping = sut.seats.all
        _ = try sut.stopped("fable", run: run.number)
        let closed = sut.seats.all
        let next = try fixture.seated(fixture.admit(sut, transport: "t2")).seat

        // Then
        #expect(open == [Seat(id: "s1", user: user, local: false)])
        #expect(stopping == open)
        #expect(closed.isEmpty)
        #expect(next == Seat(id: "s2", user: user, local: false))
    }

    @Test("a user's run that fails closes its seat and counts toward no relaunch limit")
    func failedRunCountsTowardNoLimit() throws {
        // Given
        let sut = try fixture.deckit(limit: RelaunchLimit(burst: 1, interval: 10))
        _ = try fixture.admit(sut, transport: "t1")
        let number = try #require(sut.deck.run(of: "fable")).number
        _ = try sut.started("fable", run: number, contributions: nothing)

        // When
        let effects = try sut.crashed("fable", run: number, problem: "its transport connection closed")

        // Then
        let ended = effects.compactMap { effect -> Run? in
            guard case let .tell(_, run) = effect, run.state == .notRunning else { return nil }
            return run
        }
        let run = try #require(ended.first)
        #expect(run.failed)
        #expect(sut.refusal(of: run) == nil)
        #expect(sut.seats.all.isEmpty)
        #expect(try fixture.seated(fixture.admit(sut, transport: "t2")).seat.id == "s2")
    }

    @Test("removing a user that sits asks its run to end and erases it: its record and its keys go, then its seat")
    func removeEndsWhatAUserRuns() throws {
        // Given
        let sut = try fixture.deckit()
        _ = try fixture.admit(sut, transport: "t1")
        let number = try #require(sut.deck.run(of: "fable")).number
        _ = try sut.started("fable", run: number, contributions: nothing)

        // When
        _ = try sut.removeUser("fable")
        let state = sut.deck.run(of: "fable")?.state
        _ = try sut.stopped("fable", run: number)

        // Then
        #expect(state == .terminating)
        #expect(sut.users.user(of: "fable") == nil)
        #expect(try sut.deck.keys.keys(of: "fable").isEmpty)
        #expect(sut.seats.all.isEmpty)
        #expect(sut.deck.run(of: "fable") == nil)
    }

    @Test("the local seat opens once, for a user, and that user is admitted from outside no more")
    func localSeatOpensForAUser() throws {
        // Given
        let sut = try fixture.deckit()
        try sut.addUser("host", name: "Host")
        try fixture.authorize(sut, principal: "host")

        // When
        let seat = try sut.openLocalSeat(for: "host")
        let nobody = Result { try sut.openLocalSeat(for: "nobody") }
        let again = Result { try sut.openLocalSeat(for: "fable") }
        let outside = Result { try fixture.admit(sut, transport: "t1", as: "host") }

        // Then
        #expect(seat == Seat(id: "local", user: User(id: "host", name: "Host"), local: true))
        #expect(throws: UserError.notAUser("nobody")) { try nobody.get() }
        #expect(throws: SeatError.localOpen) { try again.get() }
        #expect(throws: LaunchError.alreadyRunning("host")) { try outside.get() }
        #expect(sut.seats.all == [seat])
        #expect(sut.seats.local == seat)
    }

    @Test("a user that sits takes no local seat")
    func localSeatRefusesAUserThatSits() throws {
        // Given
        let sut = try fixture.deckit()
        _ = try fixture.admit(sut, transport: "t1")

        // When
        let refused = Result { try sut.openLocalSeat(for: "fable") }

        // Then
        #expect(throws: LaunchError.alreadyRunning("fable")) { try refused.get() }
        #expect(sut.seats.local == nil)
    }

    @Test("no mod is granted deckit.seat, and no layer defines it")
    func seatPermissionIsNoMods() throws {
        // Given
        let mods = DeckitFixture("seat-tests")
        try mods.write("asker", system: true, permissions: ["deckit.seat", "deckit.mods"])
        let permission = Permission(id: "deckit.seat", name: "Seat", description: "A layer's own.")

        // When
        let sut = try mods.deckit()
        let defined = Result { try mods.deckit(permissions: [permission]) }

        // Then
        #expect(sut.catalog.lastRead.map(\.granted) == [["deckit.mods"]])
        #expect(throws: ManifestError.permissionDefined("deckit.seat")) { try defined.get() }
    }

    // MARK: - Private
}
