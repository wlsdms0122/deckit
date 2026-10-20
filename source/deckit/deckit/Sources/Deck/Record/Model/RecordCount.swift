//
//  RecordCount.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// How many files a mod's records are, every one whatever wrote it but the hidden ones, and whether there are any
// of those.
public struct RecordCount: Encodable, Equatable, Sendable {
    // MARK: - Property
    let count: Int
    let hidden: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
