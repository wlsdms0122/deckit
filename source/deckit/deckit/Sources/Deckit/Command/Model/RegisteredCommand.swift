//
//  RegisteredCommand.swift
//  Deckit
//
//  Created by JSilver on 10/25/26.
//

import Foundation

// A command with its owner, as the registry lists it.
public struct RegisteredCommand: Equatable, Sendable {
    // MARK: - Property
    public let owner: CommandOwner
    public let command: Command

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
