//
//  ListPreferenceTests.swift
//  DeckitTests
//
//  Created by JSilver on 11/4/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("ListPreference")
struct ListPreferenceTests {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Test
    @Test("the ids placed are the person's order, then the host app's they did not place, in the host app's order")
    func placedIsThePersonsThenTheHosts() {
        // Given
        let sut = ListPreference(order: ["t", "gone"], off: ["s"])

        // When
        let placed = sut.placed(host: ["s", "gone", "r", "t"])

        // Then
        #expect(placed == ["t", "gone", "s", "r"])
    }

    @Test("with no order of the person's, the ids placed are the host app's")
    func placedWithNoOrderIsTheHosts() {
        // Given
        let sut = ListPreference.none

        // When
        let placed = sut.placed(host: ["b", "a"])

        // Then
        #expect(placed == ["b", "a"])
    }

    @Test("the ids set take the places they held among themselves, and those placed it does not name come after them")
    func arrangedPlacesTheIdsSetFirst() {
        // Given
        let sut = ListPreference(order: ["a", "b"], off: [])

        // When
        let listed = ["narrow", "a", "b", "h"]
        let arranged = sut.arranged(order: ["narrow", "b"], off: ["narrow"], host: ["h"], listed: listed)

        // Then
        #expect(arranged == ListPreference(order: ["narrow", "b", "a", "h"], off: ["narrow"]))
    }

    @Test("one placed that is not in the list now keeps its place and switch, and one named is switched on")
    func arrangedKeepsWhatIsNotListed() {
        // Given
        let sut = ListPreference(order: ["a", "gone", "b"], off: ["gone", "b"])

        // When
        let arranged = sut.arranged(order: ["b", "a"], off: [], host: [], listed: ["a", "b", "c"])

        // Then
        #expect(arranged == ListPreference(order: ["b", "gone", "a"], off: ["gone"]))
    }

    @Test("the whole list set is the order placed")
    func arrangedWithTheWholeList() {
        // Given
        let sut = ListPreference.none

        // When
        let arranged = sut.arranged(order: ["c", "b", "a"], off: ["b"], host: ["b"], listed: ["a", "b", "c"])

        // Then
        #expect(arranged == ListPreference(order: ["c", "b", "a"], off: ["b"]))
    }

    // MARK: - Private
}
