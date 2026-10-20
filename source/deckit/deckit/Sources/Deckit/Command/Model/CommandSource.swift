//
//  CommandSource.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod as a source of what a person may run: `commands`, `now` and `resolve`, whether its run registered each.
public struct CommandSource: Sendable {
    // MARK: - Property
    public let id: String
    public let name: String
    public let commands: Bool
    public let now: Bool
    public let resolve: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
