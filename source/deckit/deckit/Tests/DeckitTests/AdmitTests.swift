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

// A transport connection from outside, admitted through what Deck and Deckit make public.
@Suite("Admit")
struct AdmitTests {
    // MARK: - Property
    private let root = FileManager.default.temporaryDirectory.appending(path: "admit-tests-\(UUID().uuidString)")
    private let nonce = Data(repeating: 7, count: 32)
    private let privateKey = Curve25519.Signing.PrivateKey()

    // MARK: - Initializer
    // MARK: - Test
    @Test("a transport connection that proves an authorized key hosts a run of its principal, whose job holds nothing")
    func admitLoadsAJobThatHoldsNothing() throws {
        // Given
        let sut = try deckit()

        // When
        let effects = try admit(sut, transport: "t1")

        // Then
        let opened = effects.compactMap { effect -> Job? in
            guard case let .open(job) = effect else { return nil }
            return job
        }
        #expect(opened == [
            Job(
                principal: "outside",
                revision: "transport t1",
                host: .transport("t1"),
                permissions: [],
                reaches: .only([]),
                uses: [:],
                provides: [:]
            )
        ])
        #expect(sut.deck.run(of: "outside")?.state == .launching)
    }

    @Test("a proof that does not verify is refused, and no run of the principal it names launches")
    func admitRefusesAProofThatDoesNotVerify() throws {
        // Given
        let sut = try deckit()
        let stranger = Curve25519.Signing.PrivateKey()

        // When
        let refused = Result { try admit(sut, transport: "t1", by: stranger) }

        // Then
        #expect(throws: AuthenticationError.notAuthenticated) { try refused.get() }
        #expect(sut.deck.run(of: "outside") == nil)
    }

    @Test("a principal that runs takes no second transport connection, and its run goes on")
    func admitRefusesAPrincipalThatRuns() throws {
        // Given
        let sut = try deckit()
        _ = try admit(sut, transport: "t1")
        let run = sut.deck.run(of: "outside")

        // When
        let refused = Result { try admit(sut, transport: "t2") }

        // Then
        #expect(throws: LaunchError.alreadyRunning("outside")) { try refused.get() }
        #expect(sut.deck.run(of: "outside")?.number == run?.number)
        #expect(sut.deck.run(of: "outside")?.state == .launching)
    }

    // MARK: - Private
    // A deckit whose principal `outside` has the test's key authorized.
    private func deckit() throws -> Deckit {
        let sut = try Deckit(
            home: root.appending(path: "home"),
            ship: [],
            sources: [],
            api: try #require(Version("1.0.0")),
            permissions: []
        )
        try sut.deck.keys.authorize(
            principal: "outside",
            key: AuthorizedKey(scheme: .ed25519, key: privateKey.publicKey.rawRepresentation, name: "test")
        )

        return sut
    }

    // The transport connection asks its challenge, signs it as `outside` with `key`, the test's own where none is
    // given, and is admitted with that proof.
    private func admit(
        _ sut: Deckit,
        transport: String,
        by key: Curve25519.Signing.PrivateKey? = nil
    ) throws -> [Effect] {
        let key = key ?? privateKey
        let challenge = try sut.deck.authentication.challenge(transport: transport, nonce: nonce, binding: Data())
        let transcript = Data("deckit-authenticate-1".utf8) + [0] + Data("outside".utf8) + [0] + challenge + nonce

        return try sut.admit(
            transport: transport,
            principal: "outside",
            scheme: "ed25519",
            key: key.publicKey.rawRepresentation,
            signature: try key.signature(for: transcript)
        )
    }
}
