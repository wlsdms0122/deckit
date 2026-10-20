//
//  Dependency.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod one depends on, as it lists it: whether it is there in a version wanted, and whether it runs without it.
public struct Dependency: Equatable, Sendable {
    // MARK: - Property
    public let id: String
    public let want: String
    public let name: String
    public let ok: Bool
    public let optional: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
