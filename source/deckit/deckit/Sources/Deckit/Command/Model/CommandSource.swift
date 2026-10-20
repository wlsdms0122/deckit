//
//  CommandSource.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod as a source of what a person may run: `commands`, `now` and `resolve`, whether its run registered each.
public struct CommandSource: Encodable, Sendable {
    // MARK: - Property
    let id: String
    let name: String
    let commands: Bool
    let now: Bool
    let resolve: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
