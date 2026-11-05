//
//  Declaration.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// One entry a mod declares to an interface, as its owner is handed it: the mod's id and name, as an owner knows who
// connected, and the entry as written.
public struct Declaration: Equatable, Sendable {
    // MARK: - Property
    public let mod: String
    public let name: String
    public let entry: JSONValue

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
