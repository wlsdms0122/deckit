//
//  DataCount.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// How many files a mod's data folder holds, up to a limit: whether it holds more, and whether it holds hidden ones.
public struct DataCount: Equatable, Sendable {
    // MARK: - Property
    public internal(set) var count = 0
    public internal(set) var capped = false
    public internal(set) var hidden = false

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
