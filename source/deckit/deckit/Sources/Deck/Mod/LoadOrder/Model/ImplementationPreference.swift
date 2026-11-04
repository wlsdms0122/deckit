//
//  ImplementationPreference.swift
//  Deck
//
//  Created by JSilver on 11/4/26.
//

import Foundation

// How the person arranged an interface's implementations: the mods placed, in order, and those switched off, by id.
struct ImplementationPreference: Equatable, Sendable {
    // MARK: - Property
    static let none = ImplementationPreference(order: [], off: [])

    let order: [String]
    let off: [String]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
