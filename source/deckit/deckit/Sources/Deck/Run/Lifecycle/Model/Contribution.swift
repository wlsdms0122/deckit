//
//  Contribution.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a run contributes now, of the lifecycles that joined. Deck reads the lifecycle each interface's exports were
// opened in and those that wait for the exports of the interfaces it depends on; what the layers on deck add beside
// them, by key, it carries and does not read.
public struct Contribution: Sendable {
    // MARK: - Property
    // Interface -> the lifecycle that opened its exports.
    public let exportedIn: [String: Int]
    // Interface -> the lowest lifecycle that waits for its exports to connect.
    public let awaits: [String: Int]
    public let layers: [String: JSONValue]

    // MARK: - Initializer
    public init(exportedIn: [String: Int], awaits: [String: Int], layers: [String: JSONValue]) {
        self.exportedIn = exportedIn
        self.awaits = awaits
        self.layers = layers
    }

    // MARK: - Public
    // MARK: - Private
}
