//
//  Permission.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// What a mod asks for to reach what a layer guards with it: `name` and `description` are what a person reads before
// installing. A privileged one is granted only to a system mod.
public struct Permission: Equatable, Sendable {
    // MARK: - Property
    public let id: String
    public let name: String
    public let description: String
    public let privileged: Bool

    // MARK: - Initializer
    public init(id: String, name: String, description: String, privileged: Bool = false) {
        self.id = id
        self.name = name
        self.description = description
        self.privileged = privileged
    }

    // MARK: - Public
    // MARK: - Private
}
