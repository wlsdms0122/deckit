//
//  DataCount.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// How many files a mod's data folder holds, up to a limit: whether it holds more, and whether it holds hidden ones.
public struct DataCount: Encodable, Equatable, Sendable {
    // MARK: - Property
    var count = 0
    var capped = false
    var hidden = false

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
