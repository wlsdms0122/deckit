//
//  Deckit.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The platform on deck: what it adds, and what deck answers under it.
public final class Deckit {
    // MARK: - Property
    private let deck: Deck

    // MARK: - Initializer
    // `permissions` are those the layers on deck guard what they add with, deckit's own among them.
    public init(home: URL, ship: [URL], sources: [URL], api: Version, permissions: [Permission]) throws {
        self.deck = try Deck(
            home: home,
            ship: ship,
            sources: sources,
            api: api,
            permissions: permissions,
            fields: [URLSchemesField()]
        )
    }

    // MARK: - Public
    public func answer(_ call: Call) throws -> (any Encodable & Sendable)? {
        try deck.answer(call)
    }

    // MARK: - Private
}
