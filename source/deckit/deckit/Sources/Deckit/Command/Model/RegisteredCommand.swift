//
//  RegisteredCommand.swift
//  Deckit
//
//  Created by JSilver on 10/25/26.
//

import Foundation

// A command with its provider, as the registry lists it.
public struct RegisteredCommand: Equatable, Sendable {
    // MARK: - Property
    public let provider: CommandProvider
    public let command: Command

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
