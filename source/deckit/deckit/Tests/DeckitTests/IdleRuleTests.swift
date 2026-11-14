//
//  IdleRuleTests.swift
//  DeckitTests
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Testing
import Deck
@testable import Deckit

@Suite("IdleRule")
struct IdleRuleTests {
    // MARK: - Property
    private let home = FileManager.default.temporaryDirectory.appending(path: "idle-rule-tests-\(UUID().uuidString)")

    // MARK: - Initializer
    // MARK: - Test
    @Test(
        "the idle time is what the state keeps as idleTime, and the standard where it keeps none or names no time",
        arguments: [
            (#"{"idleTime":45}"#, 45),
            (#"{"idleTime":0}"#, 0),
            (nil, 300),
            (#"{"idleTime":-1}"#, 300),
            (#"{"idleTime":"soon"}"#, 300),
            ("not JSON", 300)
        ] as [(String?, TimeInterval)]
    )
    func timeIsWhatIsKept(text: String?, time: TimeInterval) {
        // Given
        // When
        let sut = IdleRule(kept: text)

        // Then
        #expect(sut.time == time)
    }

    @Test("a seat is idle once its devices gave no input for the idle time")
    func seatIsIdleFromTheIdleTime() {
        // Given
        let sut = IdleRule(time: 300)

        // When
        // Then
        #expect(!sut.isIdle(after: 0))
        #expect(!sut.isIdle(after: 299.9))
        #expect(sut.isIdle(after: 300))
        #expect(sut.isIdle(after: 4000))
    }

    @Test("deckit reads the idle time as it starts, from a key of the state only it writes")
    func deckitReadsItsReservedKey() throws {
        // Given
        let state = home.appending(path: "state")
        try FileManager.default.createDirectory(at: state, withIntermediateDirectories: true)
        try Data(#"{"idleTime":45}"#.utf8).write(to: state.appending(path: "seats.json"))

        // When
        let sut = try Deckit(home: home, ship: [], sources: [], api: try #require(Version("1.0.0")), permissions: [])
        let written = Result { try sut.state.write(folder: nil, key: "seats", text: #"{"idleTime":0}"#) }

        // Then
        #expect(sut.idle == IdleRule(time: 45))
        #expect(throws: StateError.reserved("seats")) { try written.get() }
    }

    // MARK: - Private
}
