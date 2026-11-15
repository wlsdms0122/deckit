//
//  SeatFixture.swift
//  DeckitTests
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import CryptoKit
import Testing
import Deck
import Deckit

// A deckit with a user, `fable`, and the transport connections that prove its key, as a party from outside does.
struct SeatFixture {
    // MARK: - Property
    private let root: URL
    private let nonce = Data(repeating: 7, count: 32)
    private let privateKey = Curve25519.Signing.PrivateKey()

    // MARK: - Initializer
    init(_ name: String) {
        root = FileManager.default.temporaryDirectory.appending(path: "\(name)-\(UUID().uuidString)")
    }

    // MARK: - Public
    // A deckit whose user `fable` has the test's key authorized.
    func deckit(limit: RelaunchLimit = RelaunchLimit(burst: 5, interval: 10)) throws -> Deckit {
        let sut = try Deckit(
            home: root.appending(path: "home"),
            ship: [],
            sources: [],
            api: try #require(Version("1.0.0")),
            permissions: [],
            limit: limit
        )
        try sut.addUser("fable", name: "Fable")
        try authorize(sut, principal: "fable")

        return sut
    }

    func authorize(_ sut: Deckit, principal: String) throws {
        try sut.deck.keys.authorize(
            principal: principal,
            key: AuthorizedKey(scheme: .ed25519, key: privateKey.publicKey.rawRepresentation, name: "test")
        )
    }

    // The transport connection asks its challenge, signs it as `principal` with `key`, the test's own where none is
    // given, and is admitted with that proof.
    func admit(
        _ sut: Deckit,
        transport: String,
        as principal: String = "fable",
        by key: Curve25519.Signing.PrivateKey? = nil
    ) throws -> Admission {
        let key = key ?? privateKey
        let challenge = try sut.deck.authentication.challenge(transport: transport, nonce: nonce, binding: Data())
        let transcript = Data("deckit-authenticate-1".utf8) + [0] + Data(principal.utf8) + [0] + challenge + nonce

        return try sut.admit(
            transport: transport,
            principal: principal,
            scheme: "ed25519",
            key: key.publicKey.rawRepresentation,
            signature: try key.signature(for: transcript)
        )
    }

    func seated(_ admission: Admission) throws -> (seat: Seat, effects: [Effect]) {
        guard case let .seated(seat, effects) = admission else {
            throw SeatError.refused
        }

        return (seat, effects)
    }

    // MARK: - Private
}
