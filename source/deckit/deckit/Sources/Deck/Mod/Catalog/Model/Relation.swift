//
//  Relation.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod another names in its [dependencies], as it names it, and what is wrong with it, or nil: a required one not
// there at that version, or an optional one there at a version it does not take.
public struct Relation: Equatable, Sendable {
    // MARK: - Property
    public let id: String
    public let optional: Bool
    public let version: String
    public let name: String
    public let problem: String?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
