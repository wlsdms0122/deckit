//
//  Key.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// A key as its owner declares it: its name, the owner's command it runs with `args`, its default chord as written,
// what a person reads it as when it has args, and where it works.
public struct Key: Decodable, Equatable, Sendable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case name
        case command
        case args
        case spec = "key"
        case label
        case scope
    }

    public let name: String
    public let command: String
    public let args: JSONValue?
    public let spec: String
    public let label: String
    public let scope: KeyScope

    // MARK: - Initializer
    public init(name: String, command: String, args: JSONValue?, spec: String, label: String, scope: KeyScope) {
        self.name = name
        self.command = command
        self.args = args
        self.spec = spec
        self.label = label
        self.scope = scope
    }

    // MARK: - Public
    // MARK: - Private
}
