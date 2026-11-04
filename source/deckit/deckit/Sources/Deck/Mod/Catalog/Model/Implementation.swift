//
//  Implementation.swift
//  Deck
//
//  Created by JSilver on 11/4/26.
//

import Foundation

// A mod in an interface's list: the version of the interface its manifest implements, and whether the person left it
// on. One switched off is never picked.
public struct Implementation: Equatable, Sendable {
    // MARK: - Property
    public let id: String
    public let name: String
    public let version: String
    public let on: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
