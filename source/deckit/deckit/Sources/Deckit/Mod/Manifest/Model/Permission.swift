//
//  Permission.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// What a mod asks for to reach what a layer guards with it: `name` and `means` are what a person reads before
// installing. A privileged one is granted only to a system mod.
public struct Permission: Equatable, Sendable {
    // MARK: - Property
    public let id: String
    public let name: String
    public let means: String
    public let privileged: Bool
    public var reach: PermissionReach {
        PermissionReach(of: id)
    }

    // MARK: - Initializer
    public init(id: String, name: String, means: String, privileged: Bool = false) {
        self.id = id
        self.name = name
        self.means = means
        self.privileged = privileged
    }

    // MARK: - Public
    // MARK: - Private
}
