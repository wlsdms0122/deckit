//
//  AdmitTests.swift
//  DeckitTests
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import CryptoKit
import Testing
import Deck
import Deckit

// A transport connection from outside, admitted as a user through what Deck and Deckit make public. The idle time is
// 300 seconds: a local seat that gave no input for 400 is idle, and one that gave none for 10 is asked.
@Suite("Admit")
struct AdmitTests {
    // MARK: - Property
    private let fixture = SeatFixture("admit-tests")
    private let user = User(id: "fable", name: "Fable")

    // MARK: - Initializer
    // MARK: - Test
    @Test("a user that proves an authorized key while the local seat is idle sits at once, its job holding deckit.seat")
    func admitSeatsAUserUnaskedWhileIdle() throws {
        // Given
        let sut = try fixture.deckit()

        // When
        let admission = try fixture.admit(sut, transport: "t1", idle: 400)

        // Then
        let (seat, effects) = try fixture.seated(admission)
        let opened = effects.compactMap { effect -> Job? in
            guard case let .open(job) = effect else { return nil }
            return job
        }
        #expect(seat.id == "s1")
        #expect(seat.user == user)
        #expect(!seat.local)
        #expect(opened == [
            Job(
                principal: "fable",
                revision: "transport t1",
                host: .transport("t1"),
                permissions: ["deckit.seat"],
                reaches: .only([]),
                uses: [:],
                provides: [:]
            )
        ])
        #expect(sut.deck.run(of: "fable")?.state == .launching)
        #expect(sut.seats.all == [seat])
    }

    @Test("a proof that does not verify is refused, and no run of the principal it names launches")
    func admitRefusesAProofThatDoesNotVerify() throws {
        // Given
        let sut = try fixture.deckit()
        let stranger = Curve25519.Signing.PrivateKey()

        // When
        let refused = Result { try fixture.admit(sut, transport: "t1", by: stranger, idle: 400) }

        // Then
        #expect(throws: AuthenticationError.notAuthenticated) { try refused.get() }
        #expect(sut.deck.run(of: "fable") == nil)
        #expect(sut.seats.all.isEmpty)
    }

    @Test("an authorized key of a principal that is no user is refused as a proof that does not verify is")
    func admitRefusesAKeyWithNoUserRecord() throws {
        // Given
        let sut = try fixture.deckit()
        try fixture.authorize(sut, principal: "keyed")

        // When
        let refused = Result { try fixture.admit(sut, transport: "t1", as: "keyed", idle: 400) }
        let asked = Result { try sut.answer(transport: "t1", allow: true) }

        // Then
        #expect(throws: AuthenticationError.notAuthenticated) { try refused.get() }
        #expect(throws: SeatError.notAsking("t1")) { try asked.get() }
        #expect(sut.deck.run(of: "keyed") == nil)
        #expect(sut.seats.all.isEmpty)
    }

    @Test("a user that runs takes no second transport connection, and its run goes on")
    func admitRefusesAUserThatRuns() throws {
        // Given
        let sut = try fixture.deckit()
        _ = try fixture.admit(sut, transport: "t1", idle: 400)
        let run = sut.deck.run(of: "fable")

        // When
        let refused = Result { try fixture.admit(sut, transport: "t2", idle: 400) }

        // Then
        #expect(throws: LaunchError.alreadyRunning("fable")) { try refused.get() }
        #expect(sut.deck.run(of: "fable")?.number == run?.number)
        #expect(sut.deck.run(of: "fable")?.state == .launching)
        #expect(sut.seats.all.map(\.id) == ["s1"])
    }

    @Test("while the local seat is not idle a user waits, and sits once the local seat lets it")
    func admitAsksAndSeatsAsAllowed() throws {
        // Given
        let sut = try fixture.deckit()

        // When
        let asking = try fixture.admit(sut, transport: "t1", idle: 10)
        let waiting = sut.deck.run(of: "fable")
        let answered = try sut.answer(transport: "t1", allow: true)

        // Then
        guard case .asking(user) = asking else {
            Issue.record("admitted without an answer: \(asking)")
            return
        }
        #expect(waiting == nil)
        #expect(try fixture.seated(answered).seat.id == "s1")
        #expect(sut.seats.seat(of: "fable")?.user == user)
        #expect(sut.deck.run(of: "fable")?.state == .launching)
    }

    @Test("a user the local seat does not let sit is refused, and waits no more")
    func admitRefusesAsDenied() throws {
        // Given
        let sut = try fixture.deckit()
        _ = try fixture.admit(sut, transport: "t1", idle: 10)

        // When
        let denied = Result { try sut.answer(transport: "t1", allow: false) }
        let again = Result { try sut.answer(transport: "t1", allow: true) }

        // Then
        #expect(throws: SeatError.refused) { try denied.get() }
        #expect(throws: SeatError.notAsking("t1")) { try again.get() }
        #expect(sut.deck.run(of: "fable") == nil)
        #expect(sut.seats.all.isEmpty)
    }

    @Test("a transport connection that closes while its user waits is answered no more")
    func closeDropsAWaitingUser() throws {
        // Given
        let sut = try fixture.deckit()
        _ = try fixture.admit(sut, transport: "t1", idle: 10)

        // When
        sut.close(transport: "t1")
        let answered = Result { try sut.answer(transport: "t1", allow: true) }

        // Then
        #expect(throws: SeatError.notAsking("t1")) { try answered.get() }
        #expect(sut.deck.run(of: "fable") == nil)
        #expect(sut.seats.all.isEmpty)
    }

    @Test("a user removed while it waits is refused as it is answered, as one that is no user")
    func answerHoldsTheUserToAdmitAgain() throws {
        // Given
        let sut = try fixture.deckit()
        _ = try fixture.admit(sut, transport: "t1", idle: 10)
        _ = try sut.removeUser("fable")

        // When
        let answered = Result { try sut.answer(transport: "t1", allow: true) }

        // Then
        #expect(throws: AuthenticationError.notAuthenticated) { try answered.get() }
        #expect(sut.seats.all.isEmpty)
    }

    // MARK: - Private
}
