//
//  Authenticator.swift
//  Deck
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// The verifier. Who a message is from is said by where it arrived, never by the message: a transport connection that
// arrived from outside is a principal's only once its claimant signed this verifier's fresh challenge with the private
// half of a key authorized for that principal.
public final class Authenticator {
    // MARK: - Property
    static let challengeLength = 32
    private let keys: AuthorizedKeyStore
    private let store: Store
    // `random(count)` is `count` bytes no claimant can foretell.
    private let random: (Int) -> Data
    // Transport connection -> what it is to sign, until it is verified or closes.
    private var challenges: [String: Challenge] = [:]

    // MARK: - Initializer
    init(keys: AuthorizedKeyStore, store: Store, random: @escaping (Int) -> Data) {
        self.keys = keys
        self.store = store
        self.random = random
    }

    // MARK: - Public
    // The schemes a claimant may sign by.
    public var schemes: [SignatureScheme] {
        SignatureScheme.allCases
    }

    // A fresh challenge for the transport connection, in place of any it had. `nonce` is the claimant's part of what is
    // signed, so the verifier does not choose it all, and `binding` the transport's channel binding, empty for a
    // transport that has none.
    public func challenge(transport: String, nonce: Data, binding: Data) throws -> Data {
        guard nonce.count == Self.challengeLength else { throw AuthenticationError.notANonce }

        let challenge = random(Self.challengeLength)
        challenges[transport] = Challenge(challenge: challenge, nonce: nonce, binding: binding)
        return challenge
    }

    // The principal the transport connection is, or a refusal that tells nothing: its challenge is used once, and
    // nothing of a principal is read before the signature holds.
    public func verify(
        transport: String,
        principal: String,
        scheme: String,
        key: Data,
        signature: Data
    ) throws -> String {
        guard let challenge = challenges.removeValue(forKey: transport),
            let scheme = SignatureScheme(rawValue: scheme),
            store.isName(principal),
            scheme.isValid(signature, of: challenge.transcript(of: principal), by: key),
            let authorized = try? keys.keys(of: principal),
            authorized.contains(where: { authorized in authorized.scheme == scheme && authorized.key == key })
        else {
            throw AuthenticationError.notAuthenticated
        }

        return principal
    }

    // The transport connection closed: its challenge is no more.
    public func close(transport: String) {
        challenges[transport] = nil
    }

    // MARK: - Private
}
