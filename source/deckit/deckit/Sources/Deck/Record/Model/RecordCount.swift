//
//  RecordCount.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// How many files a mod's records are, every one whatever wrote it, and whether a hidden one is among them.
struct RecordCount: Encodable, Equatable {
    // MARK: - Property
    let count: Int
    let hidden: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
