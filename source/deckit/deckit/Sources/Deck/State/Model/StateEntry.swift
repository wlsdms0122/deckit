//
//  StateEntry.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A key kept, and the folder of its own it is kept in, none for the state folder.
struct StateEntry: Encodable, Equatable {
    // MARK: - Property
    let folder: String?
    let key: String
    // JSON, as the key's file holds it.
    let text: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
