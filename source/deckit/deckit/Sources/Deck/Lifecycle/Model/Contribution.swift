//
//  Contribution.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a run contributed as it started. Deck reads its exports, the extension points it opens by name and what it
// extends others' points with, by each point's scoped name; what the layers on deck add beside them, by key, it
// carries and does not read.
public struct Contribution: Sendable {
    // MARK: - Property
    let exports: Snapshot
    let extensionPoints: [String]
    let extensions: [String: Snapshot]
    public let layers: [String: JSONValue]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
