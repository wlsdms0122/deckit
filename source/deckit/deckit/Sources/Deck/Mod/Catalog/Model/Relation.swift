//
//  Relation.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod another names in its manifest, as it names it: one it requires, or one whose extension points it extends, and
// whether it is there in a version wanted.
public struct Relation: Equatable, Sendable {
    public enum Kind: String, Sendable {
        case requires
        case extends
    }

    // MARK: - Property
    public let id: String
    public let kind: Kind
    public let want: String
    public let name: String
    public let ok: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
