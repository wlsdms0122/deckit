//
//  AuthenticatorTests.swift
//  DeckTests
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import CryptoKit
import Testing
@testable import Deck

@Suite("Authenticator")
struct AuthenticatorTests {
    // MARK: - Property
    private let nonce = Data(repeating: 7, count: 32)
    private let privateKey = Curve25519.Signing.PrivateKey()
    private let keys: AuthorizedKeyStore
    private let sut: Authenticator

    // MARK: - Initializer
    init() throws {
        let folder = FileManager.default.temporaryDirectory.appending(path: "authenticator-tests-\(UUID().uuidString)")
        let store = Store()
        keys = AuthorizedKeyStore(folder: folder, store: store)
        try keys.authorize(
            principal: "notes",
            key: AuthorizedKey(scheme: .ed25519, key: privateKey.publicKey.rawRepresentation, name: "test")
        )
        var count: UInt8 = 0
        sut = Authenticator(keys: keys, store: store) { length in
            count += 1
            return Data(repeating: count, count: length)
        }
    }

    // MARK: - Test
    @Test("a claimant that signs the challenge with a key authorized for the principal is that principal")
    func verifyAnswersPrincipal() throws {
        // Given
        let challenge = try sut.challenge(transport: "t1", nonce: nonce, binding: Data())

        // When
        let principal = try sut.verify(
            transport: "t1",
            principal: "notes",
            scheme: "ed25519",
            key: privateKey.publicKey.rawRepresentation,
            signature: try signature(as: "notes", challenge: challenge)
        )

        // Then
        #expect(challenge == Data(repeating: 1, count: 32))
        #expect(principal == "notes")
    }

    @Test("a key authorized for no such principal, or for another, is refused as any failure is")
    func verifyRefusesOtherKeys() throws {
        // Given
        let other = Curve25519.Signing.PrivateKey()
        let challenge = try sut.challenge(transport: "t1", nonce: nonce, binding: Data())
        let again = try sut.challenge(transport: "t2", nonce: nonce, binding: Data())

        // When
        let unregistered = Result {
            try sut.verify(
                transport: "t1",
                principal: "notes",
                scheme: "ed25519",
                key: other.publicKey.rawRepresentation,
                signature: try signature(as: "notes", challenge: challenge, by: other)
            )
        }
        let unknown = Result {
            try sut.verify(
                transport: "t2",
                principal: "nobody",
                scheme: "ed25519",
                key: privateKey.publicKey.rawRepresentation,
                signature: try signature(as: "nobody", challenge: again)
            )
        }

        // Then
        #expect(throws: AuthenticationError.notAuthenticated) { try unregistered.get() }
        #expect(throws: AuthenticationError.notAuthenticated) { try unknown.get() }
    }

    @Test("a challenge is signed once: a signature over an earlier one, or one used, is refused")
    func verifyTakesChallengeOnce() throws {
        // Given
        let key = privateKey.publicKey.rawRepresentation
        let earlier = try signature(as: "notes", challenge: try sut.challenge(transport: "t1", nonce: nonce, binding: Data()))
        let fresh = try signature(as: "notes", challenge: try sut.challenge(transport: "t1", nonce: nonce, binding: Data()))

        // When
        let replayed = Result {
            try sut.verify(transport: "t1", principal: "notes", scheme: "ed25519", key: key, signature: earlier)
        }
        let used = Result {
            try sut.verify(transport: "t1", principal: "notes", scheme: "ed25519", key: key, signature: fresh)
        }

        // Then
        #expect(throws: AuthenticationError.notAuthenticated) { try replayed.get() }
        #expect(throws: AuthenticationError.notAuthenticated) { try used.get() }
    }

    @Test("a signature made for another channel, for another transport connection or by no scheme is refused")
    func verifyBindsSignature() throws {
        // Given
        let key = privateKey.publicKey.rawRepresentation
        let bound = try sut.challenge(transport: "t1", nonce: nonce, binding: Data([1]))
        let other = try sut.challenge(transport: "t2", nonce: nonce, binding: Data())
        let third = try sut.challenge(transport: "t3", nonce: nonce, binding: Data())
        sut.close(transport: "t3")

        // When
        let relayed = Result {
            try sut.verify(
                transport: "t1",
                principal: "notes",
                scheme: "ed25519",
                key: key,
                signature: try signature(as: "notes", challenge: bound)
            )
        }
        let unknown = Result {
            try sut.verify(
                transport: "t2",
                principal: "notes",
                scheme: "none",
                key: key,
                signature: try signature(as: "notes", challenge: other)
            )
        }
        let closed = Result {
            try sut.verify(
                transport: "t3",
                principal: "notes",
                scheme: "ed25519",
                key: key,
                signature: try signature(as: "notes", challenge: third)
            )
        }

        // Then
        #expect(throws: AuthenticationError.notAuthenticated) { try relayed.get() }
        #expect(throws: AuthenticationError.notAuthenticated) { try unknown.get() }
        #expect(throws: AuthenticationError.notAuthenticated) { try closed.get() }
    }

    @Test("a nonce that is not 32 bytes is refused")
    func challengeRefusesOtherNonces() {
        // Given
        // When
        let challenge = Result { try sut.challenge(transport: "t1", nonce: Data(count: 8), binding: Data()) }

        // Then
        #expect(throws: AuthenticationError.notANonce) { try challenge.get() }
    }

    // MARK: - Private
    // The signature of a claimant on a transport with no channel binding.
    private func signature(
        as principal: String,
        challenge: Data,
        by key: Curve25519.Signing.PrivateKey? = nil
    ) throws -> Data {
        let transcript = Data("deckit-authenticate-1".utf8) + [0] + Data(principal.utf8) + [0] + challenge + nonce

        return try (key ?? privateKey).signature(for: transcript)
    }
}
