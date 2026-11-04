//
//  Relation.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// An interface a mod names in its [dependencies], as it names it, with the implementation picked for it, and what is
// wrong with it, or nil: a required one with no implementation that loads at that version, or an optional one picked at
// a version it does not take.
public struct Relation: Equatable, Sendable {
    // MARK: - Property
    public let interface: String
    public let optional: Bool
    public let version: String
    // The id and the name of the mod picked for it, or nil while none is.
    public let id: String?
    public let name: String?
    public let problem: String?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
