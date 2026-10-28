//
//  Dependency.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// A mod another names in its [dependencies], at the version it wants: a required one it runs only with, an optional one
// that comes and goes as it runs.
public struct Dependency: Equatable, Sendable {
    // MARK: - Property
    public let version: String
    public let optional: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
