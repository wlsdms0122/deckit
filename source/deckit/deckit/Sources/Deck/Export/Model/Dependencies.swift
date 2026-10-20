//
//  Dependencies.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What each mod a run requires exports, and what each of its optional dependencies exports to it now, or null.
public struct Dependencies: Encodable, Equatable, Sendable {
    // MARK: - Property
    let requires: [String: Snapshot]
    let optional: [String: Snapshot?]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
