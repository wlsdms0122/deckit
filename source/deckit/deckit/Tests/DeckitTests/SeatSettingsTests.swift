//
//  SeatSettingsTests.swift
//  DeckitTests
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Testing
import Deck
@testable import Deckit

@Suite("SeatSettings")
struct SeatSettingsTests {
    // MARK: - Property
    private let home = FileManager.default.temporaryDirectory.appending(path: "seat-settings-\(UUID().uuidString)")

    // MARK: - Initializer
    // MARK: - Test
    @Test(
        "each setting is what the state keeps of it, and the standard one where it keeps none or no value of its kind",
        arguments: [
            (#"{"idleTime":45,"asking":true}"#, 45, true),
            (#"{"idleTime":0}"#, 0, false),
            (#"{"asking":true}"#, 300, true),
            (nil, 300, false),
            (#"{"idleTime":-1,"asking":"yes"}"#, 300, false),
            (#"{"idleTime":"soon","asking":1}"#, 300, false),
            ("not JSON", 300, false)
        ] as [(String?, TimeInterval, Bool)]
    )
    func settingsAreWhatIsKept(text: String?, idleTime: TimeInterval, asking: Bool) {
        // Given
        // When
        let sut = SeatSettings(kept: text)

        // Then
        #expect(sut == SeatSettings(idleTime: idleTime, asking: asking))
    }

    @Test("deckit reads the settings from a key of the state only it writes")
    func deckitReadsItsReservedKey() throws {
        // Given
        try keep(#"{"idleTime":45}"#)
        let sut = try deckit()

        // When
        let written = Result { try sut.state.write(folder: nil, key: "seats", text: #"{"idleTime":0}"#) }

        // Then
        #expect(try sut.seatSettings() == SeatSettings(idleTime: 45, asking: false))
        #expect(throws: StateError.reserved("seats")) { try written.get() }
    }

    @Test("a setting that is set is kept, the other staying as it is kept, and none set answers those kept")
    func settingIsSetAndKept() throws {
        // Given
        try keep(#"{"idleTime":45}"#)
        let sut = try deckit()

        // When
        let asking = try sut.setSeatSettings(asking: true)
        let timed = try sut.setSeatSettings(idleTime: 0)
        let read = try sut.setSeatSettings()

        // Then
        #expect(asking == SeatSettings(idleTime: 45, asking: true))
        #expect(timed == SeatSettings(idleTime: 0, asking: true))
        #expect(read == timed)
        #expect(try sut.state.read(folder: nil, key: "seats") == #"{"asking":true,"idleTime":0}"#)
        #expect(try deckit().seatSettings() == timed)
    }

    @Test("an idle time below 0 is refused, and nothing is kept of it")
    func idleTimeBelowZeroIsRefused() throws {
        // Given
        let sut = try deckit()

        // When
        let refused = Result { try sut.setSeatSettings(idleTime: -1, asking: true) }

        // Then
        #expect(throws: SeatError.notATime(-1)) { try refused.get() }
        #expect(try sut.seatSettings() == .standard)
        #expect(try sut.state.read(folder: nil, key: "seats") == nil)
    }

    @Test("settings another run of deckit on the folder keeps are what this one reads from then on")
    func settingsKeptByAnotherRunAreRead() throws {
        // Given
        let sut = try deckit()
        let other = try deckit()

        // When
        _ = try other.setSeatSettings(asking: true)

        // Then
        #expect(try sut.seatSettings() == SeatSettings(idleTime: 300, asking: true))
    }

    // MARK: - Private
    private func deckit() throws -> Deckit {
        try Deckit(home: home, ship: [], sources: [], api: try #require(Version("1.0.0")), permissions: [])
    }

    private func keep(_ text: String) throws {
        let state = home.appending(path: "state")
        try FileManager.default.createDirectory(at: state, withIntermediateDirectories: true)
        try Data(text.utf8).write(to: state.appending(path: "seats.json"))
    }
}
