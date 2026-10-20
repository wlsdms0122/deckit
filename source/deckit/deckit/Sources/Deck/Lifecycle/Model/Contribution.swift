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
    public let exports: Snapshot
    public let extensionPoints: [String]
    public let extensions: [String: Snapshot]
    public let layers: [String: JSONValue]

    // MARK: - Initializer
    public init(
        exports: Snapshot,
        extensionPoints: [String],
        extensions: [String: Snapshot],
        layers: [String: JSONValue]
    ) {
        self.exports = exports
        self.extensionPoints = extensionPoints
        self.extensions = extensions
        self.layers = layers
    }

    // MARK: - Public
    // MARK: - Private
}
