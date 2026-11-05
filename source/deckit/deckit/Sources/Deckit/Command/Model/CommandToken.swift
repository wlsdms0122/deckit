//
//  CommandToken.swift
//  Deckit
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// One command of its sender's with the args it runs with, kept under an id deckit makes and no mod can: what a mod
// hands another to run that command, and nothing else. Deckit keeps the args as the sender gave them and never reads
// them. `holder` is the mod deckit handed it to itself, or nil for one the sender hands over.
public struct CommandToken: Codable, Equatable, Sendable {
    // MARK: - Property
    public let id: String
    public let sender: String
    public let command: String
    public let args: JSONValue?
    public let holder: String?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
