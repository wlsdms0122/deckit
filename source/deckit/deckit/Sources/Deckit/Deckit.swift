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
    public init(home: URL) {
        self.deck = Deck(home: home)
    }

    // MARK: - Public
    public func answer(_ call: Call) throws -> JSONValue? {
        try deck.answer(call)
    }

    // MARK: - Private
}
