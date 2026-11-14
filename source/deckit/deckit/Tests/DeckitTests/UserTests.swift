//
//  UserTests.swift
//  DeckitTests
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Testing
@testable import Deck
@testable import Deckit

@Suite("User")
struct UserTests {
    // MARK: - Property
    private let fixture = DeckitFixture("user-tests")

    // MARK: - Initializer
    // MARK: - Test
    @Test("a user added is kept as principal state under user, its name what a person reads, and listed by id")
    func addKeepsAUserRecord() throws {
        // Given
        let sut = try fixture.deckit()

        // When
        try sut.addUser("fable", name: "Fable")
        try sut.addUser("ada", name: "Ada")

        // Then
        #expect(sut.deck.principalState.read("user", principal: "fable") == #"{"name":"Fable"}"#)
        #expect(try sut.users.all() == [User(id: "ada", name: "Ada"), User(id: "fable", name: "Fable")])
        #expect(sut.users.user(of: "fable") == User(id: "fable", name: "Fable"))
        #expect(sut.users.user(of: "nobody") == nil)
    }

    @Test("a user added again takes the name")
    func addAgainTakesTheName() throws {
        // Given
        let sut = try fixture.deckit()
        try sut.addUser("fable", name: "Fable")

        // When
        try sut.addUser("fable", name: "Fable II")

        // Then
        #expect(try sut.users.all() == [User(id: "fable", name: "Fable II")])
    }

    @Test("an id a mod is listed under, or one that is no name, is no user's")
    func addRefusesAModAndNoName() throws {
        // Given
        try fixture.write("notes")
        let sut = try fixture.deckit()

        // When
        let mod = Result { try sut.addUser("notes", name: "Notes") }
        let unnamed = Result { try sut.addUser("../up", name: "Up") }

        // Then
        #expect(throws: UserError.isMod("notes")) { try mod.get() }
        #expect(throws: UserError.notAPrincipal("../up")) { try unnamed.get() }
        #expect(try sut.users.all().isEmpty)
    }

    @Test("removing a user erases the principal: its user record and its keys go, and another user's stay")
    func removeErasesThePrincipal() throws {
        // Given
        let sut = try fixture.deckit()
        let key = AuthorizedKey(scheme: .ed25519, key: Data(repeating: 1, count: 32), name: "test")
        for id in ["fable", "ada"] {
            try sut.addUser(id, name: id)
            try sut.deck.keys.authorize(principal: id, key: key)
        }

        // When
        let effects = try sut.removeUser("fable")

        // Then
        #expect(effects.isEmpty)
        #expect(try sut.users.all() == [User(id: "ada", name: "ada")])
        #expect(try sut.deck.keys.keys(of: "fable").isEmpty)
        #expect(try sut.deck.keys.keys(of: "ada") == [key])
        #expect(sut.deck.erasure.uncleared() == ["fable"])
    }

    @Test("an id that is no user is not removed")
    func removeRefusesNoUser() throws {
        // Given
        let sut = try fixture.deckit()

        // When
        let refused = Result { try sut.removeUser("nobody") }

        // Then
        #expect(throws: UserError.notAUser("nobody")) { try refused.get() }
        #expect(sut.deck.erasure.uncleared().isEmpty)
    }

    // MARK: - Private
}
