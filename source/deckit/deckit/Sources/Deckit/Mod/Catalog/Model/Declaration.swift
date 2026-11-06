//
//  Declaration.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// One entry a mod declares to an interface, as the mod wrote it, and the id and name of that mod: what the
// interface's owner is handed.
public struct Declaration: Equatable, Sendable {
    // MARK: - Property
    public let mod: String
    public let name: String
    public let entry: JSONValue

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
