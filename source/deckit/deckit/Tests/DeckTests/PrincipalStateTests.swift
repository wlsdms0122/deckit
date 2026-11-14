//
//  PrincipalStateTests.swift
//  DeckTests
//
//  Created by JSilver on 10/27/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("PrincipalState")
struct PrincipalStateTests {
    // MARK: - Property
    private let home: URL
    private let sut: PrincipalState

    // MARK: - Initializer
    init() {
        home = FileManager.default.temporaryDirectory.appending(path: "principal-state-tests-\(UUID().uuidString)")
        sut = PrincipalState(root: home.appending(path: "principal-state"), store: Store())
    }

    // MARK: - Test
    @Test("what a name keeps of a principal is its own, one file a principal in the name's folder")
    func eachNameKeepsItsOwn() throws {
        // Given
        try sut.reserve("layer")
        try sut.reserve("other-layer")

        // When
        try sut.write("layer", principal: "notes", text: #"{"wrap":true}"#)
        try sut.write("other-layer", principal: "other", text: "[]")

        // Then
        #expect(sut.read("layer", principal: "notes") == #"{"wrap":true}"#)
        #expect(sut.read("other-layer", principal: "notes") == nil)
        #expect(sut.kept(principal: "notes") == ["layer"])
        #expect(sut.kept(principal: "other") == ["other-layer"])
        let other = home.appending(path: "principal-state/other-layer/other.json")
        #expect(FileManager.default.fileExists(atPath: other.path()))
    }

    @Test("a name reserved again, or one that is no name, is refused")
    func nameIsReservedOnce() throws {
        // Given
        try sut.reserve("layer")

        // When
        let again = Result { try sut.reserve("layer") }
        let unnamed = Result { try sut.reserve("../up") }

        // Then
        #expect(throws: PrincipalStateError.reserved("layer")) { try again.get() }
        #expect(throws: PrincipalStateError.notAName("../up")) { try unnamed.get() }
    }

    @Test("erasing a principal takes what every name keeps of it, and nothing of another principal's")
    func eraseTakesEveryName() throws {
        // Given
        try sut.reserve("layer")
        try sut.reserve("other-layer")
        try sut.write("layer", principal: "notes", text: "{}")
        try sut.write("other-layer", principal: "notes", text: "[]")
        try sut.write("other-layer", principal: "other", text: "[]")

        // When
        try sut.erase(principal: "notes")
        try sut.erase(principal: "never")

        // Then
        #expect(sut.kept(principal: "notes").isEmpty)
        #expect(sut.kept(principal: "other") == ["other-layer"])
    }
}
