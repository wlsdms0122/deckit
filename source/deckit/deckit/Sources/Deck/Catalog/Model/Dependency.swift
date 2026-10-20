//
//  Dependency.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod one depends on, as it lists it: whether it is there in a version wanted, and whether it runs without it.
public struct Dependency: Encodable, Equatable, Sendable {
    // MARK: - Property
    let id: String
    let want: String
    let name: String
    let ok: Bool
    let optional: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
