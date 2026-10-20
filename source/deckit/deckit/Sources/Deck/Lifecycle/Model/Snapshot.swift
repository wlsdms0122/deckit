//
//  Snapshot.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a mod exports, or extends a point with: its values as JSON text, carried as written and not read, and the path
// of each of its functions, which its page answers when it is called.
public struct Snapshot: Codable, Equatable, Sendable {
    // MARK: - Property
    let values: String
    let functions: [[String]]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
