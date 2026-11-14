//
//  AuthenticationError.swift
//  Deck
//
//  Created by JSilver on 11/15/26.
//

import Foundation

public enum AuthenticationError: Refusal, Equatable {
    // Whatever failed: nothing tells a claimant a principal that is not there from a key that is not its.
    case notAuthenticated
    case notANonce
    case notAPrincipal(String)
    case notAKey(SignatureScheme)
    case unreadable(String)

    // MARK: - Property
    public var message: String {
        switch self {
        case .notAuthenticated:
            "not authenticated"

        case .notANonce:
            "a nonce is \(Authenticator.challengeLength) bytes"

        case let .notAPrincipal(principal):
            "not an id: \(principal)"

        case let .notAKey(scheme):
            "a public key of \(scheme.rawValue) is \(scheme.keyLength) bytes"

        case let .unreadable(principal):
            "the authorized keys of \(principal) are not as deck writes them"
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
