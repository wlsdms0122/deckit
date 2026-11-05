//
//  InterfaceContribution.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// An entry a mod declares to an interface, as its owner is handed it: the mod's id and name, the entry without the
// command and args it names, and, when it names one, a token of that command the owner holds.
public struct InterfaceContribution: Equatable, Sendable {
    // MARK: - Property
    public let mod: String
    public let name: String
    public let entry: JSONValue
    public let token: String?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
