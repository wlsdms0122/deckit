//
//  AuthorizedKeyStoreTests.swift
//  DeckTests
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Testing
@testable import Deck

@Suite("AuthorizedKeyStore")
struct AuthorizedKeyStoreTests {
    // MARK: - Property
    private let folder: URL
    private let sut: AuthorizedKeyStore

    // MARK: - Initializer
    init() {
        folder = FileManager.default.temporaryDirectory.appending(path: "authorized-keys-tests-\(UUID().uuidString)")
        sut = AuthorizedKeyStore(folder: folder, store: Store())
    }

    // MARK: - Test
    @Test("a principal's keys are those authorized for it, in the order they were, and no other principal's")
    func authorizeKeepsKeys() throws {
        // Given
        let first = AuthorizedKey(scheme: .ed25519, key: Data(repeating: 1, count: 32), name: "first")
        let second = AuthorizedKey(scheme: .ed25519, key: Data(repeating: 2, count: 32), name: "second")

        // When
        try sut.authorize(principal: "notes", key: first)
        try sut.authorize(principal: "notes", key: second)

        // Then
        #expect(try sut.keys(of: "notes") == [first, second])
        #expect(try sut.keys(of: "other") == [])
        #expect(sut.count(principal: "notes") == 2)
    }

    @Test("a key authorized again takes the name it is given, and is one key")
    func authorizeAgainRenames() throws {
        // Given
        let key = Data(repeating: 1, count: 32)
        try sut.authorize(principal: "notes", key: AuthorizedKey(scheme: .ed25519, key: key, name: "old"))

        // When
        try sut.authorize(principal: "notes", key: AuthorizedKey(scheme: .ed25519, key: key, name: "new"))

        // Then
        #expect(try sut.keys(of: "notes") == [AuthorizedKey(scheme: .ed25519, key: key, name: "new")])
    }

    @Test("a key revoked is the principal's no more, and a principal with no key keeps no file")
    func revokeRemovesKey() throws {
        // Given
        let key = Data(repeating: 1, count: 32)
        try sut.authorize(principal: "notes", key: AuthorizedKey(scheme: .ed25519, key: key, name: "only"))

        // When
        try sut.revoke(principal: "notes", scheme: .ed25519, key: key)

        // Then
        #expect(try sut.keys(of: "notes") == [])
        #expect(!FileManager.default.fileExists(atPath: folder.appending(path: "notes.json").path(percentEncoded: false)))
    }

    @Test("a key that is not as long as its scheme's is refused")
    func authorizeRefusesOtherLengths() {
        // Given
        let key = AuthorizedKey(scheme: .ed25519, key: Data(repeating: 1, count: 31), name: "short")

        // When
        let authorized = Result { try sut.authorize(principal: "notes", key: key) }

        // Then
        #expect(throws: AuthenticationError.notAKey(.ed25519)) { try authorized.get() }
    }

    @Test("an id that is no principal's is refused", arguments: ["../notes", "Notes"])
    func keysRefuseOtherIds(principal: String) {
        // Given
        // When
        let keys = Result { try sut.keys(of: principal) }

        // Then
        #expect(throws: AuthenticationError.notAPrincipal(principal)) { try keys.get() }
    }

    @Test("a file that is not as deck writes it is refused, never read as no keys")
    func keysRefuseOtherFiles() throws {
        // Given
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try Data(#"{"scheme":"ed25519"}"#.utf8).write(to: folder.appending(path: "notes.json"))

        // When
        let keys = Result { try sut.keys(of: "notes") }

        // Then
        #expect(throws: AuthenticationError.unreadable("notes")) { try keys.get() }
    }
}
