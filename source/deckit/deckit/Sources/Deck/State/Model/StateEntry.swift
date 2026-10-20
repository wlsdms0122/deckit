//
//  StateEntry.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A key kept, and the folder of its own it is kept in, none for the state folder.
public struct StateEntry: Equatable, Sendable {
    // MARK: - Property
    public let folder: String?
    public let key: String
    // JSON, as the key's file holds it.
    public let text: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
