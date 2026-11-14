//
//  AuthorizedKey.swift
//  Deck
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// A public key that may authenticate as the principal it is registered for, under the name it was registered with.
public struct AuthorizedKey: Equatable, Sendable {
    // MARK: - Property
    public let scheme: SignatureScheme
    public let key: Data
    public let name: String

    // MARK: - Initializer
    public init(scheme: SignatureScheme, key: Data, name: String) {
        self.scheme = scheme
        self.key = key
        self.name = name
    }

    // MARK: - Public
    // MARK: - Private
}
