//
//  Contribution.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a run contributes now, of the lifecycles that joined. Deck reads the lifecycle each of its exports was opened in
// and those that wait for the exports it reaches; what the layers on deck add beside them, by key, it carries and does
// not read.
public struct Contribution: Sendable {
    // MARK: - Property
    // An interface it provides, or its own id for its dependents -> the lifecycle that opened its exports for it.
    public let exportedIn: [String: Int]
    // A name its manifest gives, a mod id or an interface -> the lowest lifecycle that waits for the exports it reaches
    // by it to connect.
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
