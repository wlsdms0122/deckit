//
//  ImplementationPreferenceTests.swift
//  DeckTests
//
//  Created by JSilver on 11/4/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("ImplementationPreference")
struct ImplementationPreferenceTests {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Test
    @Test("the ids placed are the person's order, then the host app's they did not place, in the host app's order")
    func placedIsThePersonsThenTheHosts() {
        // Given
        let sut = ImplementationPreference(order: ["t", "gone"], off: ["s"])

        // When
        let placed = sut.placed(host: ["s", "gone", "r", "t"])

        // Then
        #expect(placed == ["t", "gone", "s", "r"])
    }

    @Test("with no order of the person's, the ids placed are the host app's")
    func placedWithNoOrderIsTheHosts() {
        // Given
        let sut = ImplementationPreference.none

        // When
        let placed = sut.placed(host: ["b", "a"])

        // Then
        #expect(placed == ["b", "a"])
    }

    // MARK: - Private
}
