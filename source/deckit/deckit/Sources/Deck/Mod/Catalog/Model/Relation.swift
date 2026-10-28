//
//  Relation.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod another names in its [dependencies], as it names it, and why it is not there at that version, or nil. An
// optional one not installed or not loaded is not there and nothing is wrong: only a version it does not satisfy is.
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
