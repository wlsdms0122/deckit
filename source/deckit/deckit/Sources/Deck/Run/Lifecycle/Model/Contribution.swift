//
//  Contribution.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a run contributes now to reach, of the lifecycles that joined: the lifecycle each of its exports was opened in,
// and those that wait for the exports it reaches.
public struct Contribution: Sendable {
    // MARK: - Property
    // An interface it provides, or its own id for those that reach it by id -> the lifecycle that opened its exports
    // for it.
    public let exportedIn: [String: Int]
    // A name its job reaches by, a principal or an interface -> the lowest lifecycle that waits for the exports it
    // reaches by it to connect.
    public let awaits: [String: Int]

    // MARK: - Initializer
    public init(exportedIn: [String: Int], awaits: [String: Int]) {
        self.exportedIn = exportedIn
        self.awaits = awaits
    }

    // MARK: - Public
    // MARK: - Private
}
