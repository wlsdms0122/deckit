//
//  Declaration.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// One entry a mod declares to an interface, as the mod wrote it: its id and name, and the entry. What the interface's
// owner is handed is made of it by a layer on deck.
public struct Declaration: Equatable, Sendable {
    // MARK: - Property
    public let mod: String
    public let name: String
    public let entry: JSONValue

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
