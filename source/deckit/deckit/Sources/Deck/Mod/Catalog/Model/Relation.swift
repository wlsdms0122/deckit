//
//  Relation.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod another names in its [dependencies], as it names it, and whether it is there in a version wanted.
public struct Relation: Equatable, Sendable {
    // MARK: - Property
    public let id: String
    public let optional: Bool
    public let want: String
    public let name: String
    public let ok: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
