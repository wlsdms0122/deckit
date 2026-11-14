//
//  SignatureScheme.swift
//  Deck
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import CryptoKit

// How a claimant proves it holds the private half of an authorized key: by a digital signature the public half checks.
public enum SignatureScheme: String, CaseIterable, Sendable {
    // Ed25519 (RFC 8032): a public key of 32 bytes, a signature of 64.
    case ed25519

    // MARK: - Property
    var keyLength: Int {
        switch self {
        case .ed25519:
            32
        }
    }

    // MARK: - Initializer
    // MARK: - Public
    // Whether `signature` is the signature of `message` by the private half of `key`.
    func isValid(_ signature: Data, of message: Data, by key: Data) -> Bool {
        switch self {
        case .ed25519:
            guard let key = try? Curve25519.Signing.PublicKey(rawRepresentation: key) else { return false }
            return key.isValidSignature(signature, for: message)
        }
    }

    // MARK: - Private
}
