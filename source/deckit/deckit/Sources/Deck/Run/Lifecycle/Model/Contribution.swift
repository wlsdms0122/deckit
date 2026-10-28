//
//  Contribution.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a run contributes now, of the lifecycles that joined. Deck reads the lifecycle its exports were opened in and
// those that wait for other mods' exports; what the layers on deck add beside them, by key, it carries and does not
// read.
public struct Contribution: Sendable {
    // MARK: - Property
    // The lifecycle that opened its exports, or nil while none did.
    public let exports: Int?
    // Mod id -> the lowest lifecycle that waits for that mod's exports to connect.
    public let awaits: [String: Int]
    public let layers: [String: JSONValue]

    // MARK: - Initializer
    public init(exports: Int?, awaits: [String: Int], layers: [String: JSONValue]) {
        self.exports = exports
        self.awaits = awaits
        self.layers = layers
    }

    // MARK: - Public
    // MARK: - Private
}
