//
//  Permission.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a mod asks for to reach what a layer guards with it: `name` and `means` are what a person reads before
// installing.
public struct Permission: Equatable, Sendable {
    // MARK: - Property
    public let id: String
    public let name: String
    public let means: String
    public let reach: PermissionReach

    // MARK: - Initializer
    public init(id: String, name: String, means: String, reach: PermissionReach) {
        self.id = id
        self.name = name
        self.means = means
        self.reach = reach
    }

    // MARK: - Public
    // MARK: - Private
}
